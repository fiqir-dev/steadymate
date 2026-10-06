import mongoose from "mongoose"
import { Request, Response } from "express"

import { Payment } from "../models/Payment"
import { Referral } from "../models/Referral"
import { ReferralReward } from "../models/ReferralReward"
import { User } from "../models/User"
import { ReferralWithdrawal } from "../models/ReferralWithdrawal"
import {
  PREMIUM_DURATION_DAYS,
  PREMIUM_MONTHLY_PRICE,
  REFERRAL_REWARD_PERCENTAGE,
  getReferralRewardValue,
} from "../config/pricing"
import { sendTelegramMessage } from "../services/telegramBotService"
import { getReferralOverview } from "../services/referralService"

export const getAdminDashboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const now = new Date()
    const [totalUsers, freeUsers, premiumUsers, pendingPayments, approvedPayments, pendingRewards, totalRewards, totalRevenue] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({
        $or: [
          { isPremium: { $ne: true } },
          { premiumExpiresAt: null },
          { premiumExpiresAt: { $lte: now } },
          { premiumExpiresAt: { $exists: false } },
        ],
      }),
      User.countDocuments({
        isPremium: true,
        premiumExpiresAt: { $gt: now },
      }),
      Payment.countDocuments({ type: { $in: ["premium", null] }, status: "pending" }),
      Payment.countDocuments({ type: { $in: ["premium", null] }, status: "approved" }),
      ReferralReward.countDocuments({ status: "pending" }),
      ReferralReward.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { type: { $in: ["premium", null] }, status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ])

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        freeUsers,
        premiumUsers,
        pendingPayments,
        approvedPayments,
        pendingReferralRewards: pendingRewards,
        totalReferralRewards: totalRewards[0]?.total || 0,
        totalPremiumRevenue: totalRevenue[0]?.total || 0,
        premiumPrice: PREMIUM_MONTHLY_PRICE,
        referralReward: getReferralRewardValue(),
      },
    })
  } catch (error) {
    console.error("Get admin dashboard error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load admin dashboard",
    })
  }
}

export const getAdminPayments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const payments = await Payment.find({ type: { $in: ["premium", null] } })
      .sort({ submittedAt: -1 })
      .populate({ path: "userId", select: "name email" })
      .lean()

    res.status(200).json({
      success: true,
      payments: payments.map((payment) => {
        const userInfo = payment.userId as { name?: string; email?: string } | null

        return {
          id: payment._id,
          userId: payment.userId,
          studentName: payment.studentName || userInfo?.name || "Unknown",
          studentEmail: payment.email || userInfo?.email || "",
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.paymentMethod || "",
          status: payment.status,
          telegramReference: payment.telegramReference || "",
          hasScreenshot: Boolean(payment.screenshotUrl || payment.telegramFileId || payment.screenshot),
          screenshotUrl: payment.screenshotUrl || payment.telegramFileId || payment.screenshot
            ? `/api/admin/payments/${payment._id}/screenshot`
            : "",
          submittedAt: payment.submittedAt,
          reviewedAt: payment.reviewedAt,
          telegramChatId: payment.telegramChatId || "",
          reviewedBy: payment.reviewedBy,
        }
      }),
    })
  } catch (error) {
    console.error("Get admin payments error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load payment verification queue",
    })
  }
}

export const getAdminPaymentScreenshot = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      type: { $in: ["premium", null] },
    }).select("screenshotUrl")

    if (!payment?.screenshotUrl) {
      res.status(404).json({
        success: false,
        message: "Payment screenshot is not available for this payment.",
      })
      return
    }

    const screenshotUrl = new URL(payment.screenshotUrl)
    if (
      screenshotUrl.protocol !== "https:" ||
      screenshotUrl.hostname !== "res.cloudinary.com" ||
      screenshotUrl.username ||
      screenshotUrl.password
    ) {
      res.status(502).json({
        success: false,
        message: "Stored payment screenshot URL is invalid.",
      })
      return
    }

    res.redirect(302, screenshotUrl.toString())
  } catch (error) {
    console.error("Get admin payment screenshot error:", error)
    res.status(502).json({
      success: false,
      message: "Unable to retrieve payment screenshot",
    })
  }
}

export const approvePayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    const session = await mongoose.startSession()
    let approvedPaymentId: string | null = null
    let chatId = ""
    let expiresAt = new Date()

    try {
      await session.withTransaction(async () => {
        const payment = await Payment.findOneAndUpdate(
          { _id: req.params.id, type: { $in: ["premium", null] }, status: "pending" },
          {
            $set: {
              status: "approved",
              reviewedAt: new Date(),
              reviewedBy: new mongoose.Types.ObjectId(req.userId),
            },
          },
          { new: true, session },
        )
        if (!payment) return

        const user = await User.findById(payment.userId).session(session)
        if (!user) throw new Error("Associated student account not found")

        expiresAt = new Date(Date.now() + PREMIUM_DURATION_DAYS * 24 * 60 * 60 * 1000)
        user.isPremium = true
        user.premiumExpiresAt = expiresAt
        await user.save({ session })

        if (user.referredBy) {
          await ReferralReward.updateOne(
            { paymentId: payment._id },
            {
              $setOnInsert: {
                referrerId: user.referredBy,
                referredUserId: user._id,
                paymentId: payment._id,
                amount: getReferralRewardValue(payment.amount),
                percentage: REFERRAL_REWARD_PERCENTAGE,
                status: "pending",
              },
            },
            { upsert: true, session },
          )
        }

        approvedPaymentId = payment._id.toString()
        chatId = payment.telegramChatId || ""
      })
    } finally {
      await session.endSession()
    }

    if (!approvedPaymentId) {
      const payment = await Payment.findById(req.params.id).select("status")
      res.status(payment ? 409 : 404).json({
        success: false,
        message: payment
          ? "Only pending payments can be approved"
          : "Payment request not found",
      })
      return
    }

    if (chatId) {
      try {
        await sendTelegramMessage(
          chatId,
          `Your Steady Mate Premium payment has been approved. Premium is now active for ${PREMIUM_DURATION_DAYS} days. Enjoy studying!`,
        )
      } catch (error) {
        console.error("Unable to notify student about approved payment:", error)
      }
    }

    res.status(200).json({
      success: true,
      message: "Premium payment approved and account activated.",
      payment: {
        id: approvedPaymentId,
        status: "approved",
        premiumExpiresAt: expiresAt,
      },
    })
  } catch (error) {
    console.error("Approve payment error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to approve payment",
    })
  }
}

export const rejectPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    const reason = typeof req.body?.reason === "string"
      ? req.body.reason.trim().slice(0, 500)
      : ""
    const payment = await Payment.findOneAndUpdate(
      { _id: req.params.id, type: { $in: ["premium", null] }, status: "pending" },
      {
        $set: {
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: new mongoose.Types.ObjectId(req.userId),
          rejectionReason: reason,
        },
      },
      { new: true },
    )

    if (!payment) {
      const existing = await Payment.findById(req.params.id).select("status")
      res.status(existing ? 409 : 404).json({
        success: false,
        message: existing
          ? "Only pending payments can be rejected"
          : "Payment request not found",
      })
      return
    }

    if (payment.telegramChatId) {
      try {
        await sendTelegramMessage(
          payment.telegramChatId,
          "Your Steady Mate Premium payment could not be verified. Please contact support if you believe this was a mistake.",
        )
      } catch (error) {
        console.error("Unable to notify student about rejected payment:", error)
      }
    }

    res.status(200).json({
      success: true,
      message: "Premium payment rejected.",
      payment: {
        id: payment._id,
        status: payment.status,
      },
    })
  } catch (error) {
    console.error("Reject payment error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to reject payment",
    })
  }
}

export const getAdminReferrals = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rewards = await ReferralReward.find()
      .sort({ createdAt: -1 })
      .populate({ path: "referrerId", select: "name email referralCode" })
      .populate({ path: "referredUserId", select: "name email" })
      .populate({ path: "paymentId", select: "amount status submittedAt" })
      .lean()

    res.status(200).json({
      success: true,
      rewards: rewards.map((reward) => ({
        id: reward._id,
        referrer: reward.referrerId,
        referredUser: reward.referredUserId,
        payment: reward.paymentId,
        amount: reward.amount,
        percentage: reward.percentage,
        status: reward.status,
        createdAt: reward.createdAt,
        paidAt: reward.paidAt,
      })),
    })
  } catch (error) {
    console.error("Get admin referrals error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load referral management data",
    })
  }
}

export const getAdminReferralSummary = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const referrerIds = await Referral.distinct("referrerId")
    const summaries = await Promise.all(
      referrerIds.map(async (referrerId) => {
        const [user, overview] = await Promise.all([
          User.findById(referrerId).select("name email"),
          getReferralOverview(referrerId.toString()),
        ])
        return {
          referrer: user
            ? { id: user._id, name: user.name, email: user.email }
            : null,
          successfulReferrals: overview.successfulReferralCount,
          totalEarnings: overview.totalEarnings,
          availableBalance: overview.availableBalance,
          withdrawalEligible: overview.withdrawalEligible,
        }
      }),
    )
    const withdrawalRecords = await ReferralWithdrawal.find()
      .sort({ createdAt: -1 })
      .lean()
    const withdrawals = await Promise.all(withdrawalRecords.map(async (withdrawal) => {
      const [user, overview] = await Promise.all([
        User.findById(withdrawal.userId).select("name email"),
        getReferralOverview(withdrawal.userId.toString()),
      ])
      return {
        id: withdrawal._id,
        user: user
          ? { id: user._id, name: user.name, email: user.email }
          : null,
        amount: withdrawal.amount,
        paymentMethod: withdrawal.paymentMethod || "unknown",
        bankName: withdrawal.bankName || "",
        accountHolderName: withdrawal.accountHolderName,
        accountNumber: withdrawal.accountNumber || "",
        telebirrPhone: withdrawal.telebirrPhone || "",
        successfulReferralCount: overview.successfulReferralCount,
        availableBalance: overview.availableBalance,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
        reviewedAt: withdrawal.reviewedAt,
        paidAt: withdrawal.paidAt,
        rejectionReason: withdrawal.rejectionReason,
      }
    }))

    res.status(200).json({
      success: true,
      summaries: summaries.filter((summary) => summary.referrer),
      withdrawals,
    })
  } catch (error) {
    console.error("Get admin referral summary error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load referral earnings and withdrawals",
    })
  }
}

export const getAdminWithdrawals = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await getAdminReferralSummary(req, res)
}

export const reviewReferralWithdrawal = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const action = Array.isArray(req.params.action)
    ? req.params.action[0]
    : req.params.action
  const withdrawalId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id
  if (!["approve", "reject", "pay"].includes(action)) {
    res.status(400).json({ success: false, message: "Invalid withdrawal action" })
    return
  }
  const rejectionReason = typeof req.body?.reason === "string"
    ? req.body.reason.trim().slice(0, 500)
    : ""
  if (action === "reject" && !rejectionReason) {
    res.status(400).json({
      success: false,
      message: "A rejection reason is required.",
    })
    return
  }
  if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
    res.status(401).json({ success: false, message: "Authentication required" })
    return
  }

  const session = await mongoose.startSession()
  let result: { id: string; status: string } | null = null
  let missingPayoutDetails = false
  try {
    await session.withTransaction(async () => {
      const allowedStatuses = action === "pay"
        ? ["approved"]
        : action === "approve" || action === "reject"
          ? ["pending"]
          : []
      if (action !== "reject") {
        const current = await ReferralWithdrawal.findOne({
          _id: withdrawalId,
          status: { $in: allowedStatuses },
        }).session(session)
        if (!current) return
        const hasPayoutDetails = current.paymentMethod === "bank_transfer"
          ? Boolean(current.bankName?.trim() && current.accountHolderName?.trim() && current.accountNumber?.trim())
          : current.paymentMethod === "telebirr"
            ? Boolean(current.accountHolderName?.trim() && current.telebirrPhone?.trim())
            : false
        if (!hasPayoutDetails) {
          missingPayoutDetails = true
          return
        }
      }
      const withdrawal = await ReferralWithdrawal.findOneAndUpdate(
        { _id: withdrawalId, status: { $in: allowedStatuses } },
        {
          $set: action === "approve"
            ? { status: "approved", reviewedBy: new mongoose.Types.ObjectId(req.userId), reviewedAt: new Date() }
            : action === "reject"
              ? {
                  status: "rejected",
                  reviewedBy: new mongoose.Types.ObjectId(req.userId),
                  reviewedAt: new Date(),
                  rejectionReason,
                }
              : {
                  status: "paid",
                  paidAt: new Date(),
                  paidBy: new mongoose.Types.ObjectId(req.userId),
                },
        },
        { new: true, session },
      )
      if (!withdrawal) return

      if (action === "reject" || action === "pay") {
        const balanceUpdate = action === "reject"
          ? { $inc: { referralReservedBalance: -withdrawal.amount, referralBalanceVersion: 1 } }
          : {
              $inc: {
                referralReservedBalance: -withdrawal.amount,
                referralWithdrawnBalance: withdrawal.amount,
                referralBalanceVersion: 1,
              },
            }
        const balanceUpdateResult = await User.updateOne(
          {
            _id: withdrawal.userId,
            referralReservedBalance: { $gte: withdrawal.amount },
          },
          balanceUpdate,
          { session },
        )
        if (balanceUpdateResult.modifiedCount !== 1) {
          throw new Error("Withdrawal balance reservation is inconsistent")
        }
      } else {
        const balanceLockResult = await User.updateOne(
          { _id: withdrawal.userId },
          { $inc: { referralBalanceVersion: 1 } },
          { session },
        )
        if (balanceLockResult.modifiedCount !== 1) {
          throw new Error("Withdrawal owner account not found")
        }
      }
      result = { id: withdrawal._id.toString(), status: withdrawal.status }
    })

    if (!result) {
      if (missingPayoutDetails) {
        res.status(409).json({
          success: false,
          message: "This withdrawal is missing valid payout details and cannot be approved or paid.",
        })
        return
      }
      const current = await ReferralWithdrawal.findById(withdrawalId).select("status")
      res.status(current ? 409 : 404).json({
        success: false,
        message: current
          ? `Withdrawal cannot be ${action}d from its current status.`
          : "Withdrawal request not found",
      })
      return
    }

    if (action === "pay") {
      try {
        const paidWithdrawal = await ReferralWithdrawal.findById(withdrawalId)
          .select("userId amount paymentMethod")
          .lean()
        if (paidWithdrawal) {
          const student = await User.findById(paidWithdrawal.userId)
            .select("+telegramUserId telegramVerified")
            .lean()
          if (student?.telegramVerified && student.telegramUserId) {
            const method = paidWithdrawal.paymentMethod === "telebirr"
              ? "through Telebirr"
              : "by Bank Transfer"
            await sendTelegramMessage(
              student.telegramUserId,
              `Withdrawal Paid ✓\n\nYour ${paidWithdrawal.amount} ETB referral withdrawal has been paid successfully ${method}.\n\nPlease check your account.`,
            )
          }
        }
      } catch (notificationError) {
        console.error("Referral withdrawal paid notification failed:", notificationError)
      }
    }

    res.status(200).json({
      success: true,
      message: action === "pay"
        ? "Withdrawal marked as paid."
        : action === "approve"
          ? "Withdrawal approved."
          : "Withdrawal rejected.",
      withdrawal: result,
    })
  } catch (error) {
    console.error("Review referral withdrawal error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to review withdrawal request",
    })
  } finally {
    await session.endSession()
  }
}

export const markReferralPaid = async (
  req: Request,
  res: Response
): Promise<void> => {
  const session = await mongoose.startSession()
  try {
    let rewardId: string | null = null
    await session.withTransaction(async () => {
      const current = await ReferralReward.findOne({
        _id: req.params.id,
        status: "approved",
      }).session(session)
      if (!current) return

      const overview = await getReferralOverview(current.referrerId.toString(), session)
      if (overview.availableBalance < current.amount) {
        throw new Error("This reward is reserved by an existing withdrawal request.")
      }

      const balanceLock = await User.updateOne(
        { _id: current.referrerId },
        { $inc: { referralBalanceVersion: 1 } },
        { session },
      )
      if (balanceLock.modifiedCount !== 1) {
        throw new Error("Referral owner account not found")
      }

      const reward = await ReferralReward.findOneAndUpdate(
        { _id: current._id, status: "approved" },
        { $set: { status: "paid", paidAt: new Date() } },
        { new: true, session },
      )
      if (reward) rewardId = reward._id.toString()
    })

    if (!rewardId) {
      const existing = await ReferralReward.findById(req.params.id).select("status")
      res.status(existing ? 409 : 404).json({
        success: false,
        message: existing
          ? "Only approved referral rewards can be marked as paid"
          : "Referral reward not found",
      })
      return
    }

    const reward = await ReferralReward.findById(rewardId)
    if (!reward) {
      res.status(404).json({ success: false, message: "Referral reward not found" })
      return
    }
    res.status(200).json({
      success: true,
      message: "Referral reward marked as paid.",
      reward: {
        id: reward._id,
        status: reward.status,
        paidAt: reward.paidAt,
      },
    })
  } catch (error) {
    console.error("Mark referral paid error:", error)
    const conflict = error instanceof Error && error.message.includes("reserved")
    res.status(conflict ? 409 : 500).json({
      success: false,
      message: conflict
        ? error.message
        : "Unable to mark referral reward as paid",
    })
  } finally {
    await session.endSession()
  }
}

export const approveReferralReward = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession()
  try {
    let rewardId: string | null = null
    await session.withTransaction(async () => {
      const current = await ReferralReward.findOne({
        _id: req.params.id,
        status: "pending",
      }).session(session)
      if (!current) return
      const balanceLock = await User.updateOne(
        { _id: current.referrerId },
        { $inc: { referralBalanceVersion: 1 } },
        { session },
      )
      if (balanceLock.modifiedCount !== 1) {
        throw new Error("Referral owner account not found")
      }
      const reward = await ReferralReward.findOneAndUpdate(
        { _id: current._id, status: "pending" },
        { $set: { status: "approved", approvedAt: new Date() } },
        { new: true, session },
      )
      if (reward) rewardId = reward._id.toString()
    })

    if (!rewardId) {
      const existing = await ReferralReward.findById(req.params.id).select("status")
      res.status(existing ? 409 : 404).json({
        success: false,
        message: existing
          ? "Only pending referral rewards can be approved"
          : "Referral reward not found",
      })
      return
    }

    const reward = await ReferralReward.findById(rewardId)
    res.status(200).json({
      success: true,
      message: "Referral reward approved.",
      reward: {
        id: reward?._id,
        status: reward?.status,
        approvedAt: reward?.approvedAt,
      },
    })
  } catch (error) {
    console.error("Approve referral reward error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to approve referral reward",
    })
  } finally {
    await session.endSession()
  }
}

export const getAdminUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select("name email role isPremium premiumExpiresAt referralCode createdAt referredBy")
      .lean()

    res.status(200).json({
      success: true,
      users: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.isPremium && user.premiumExpiresAt instanceof Date && user.premiumExpiresAt > new Date() ? "Premium" : "Free",
        premiumExpiresAt: user.premiumExpiresAt || null,
        referralCode: user.referralCode || "",
        referralCount: user.referredBy ? 1 : 0,
        registeredAt: user.createdAt,
      })),
    })
  } catch (error) {
    console.error("Get admin users error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load user management data",
    })
  }
}

export const getAdminReferralHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const referrals = await Referral.find()
      .sort({ createdAt: -1 })
      .populate({ path: "referrerId", select: "name email" })
      .populate({ path: "referredUserId", select: "name email" })
      .lean()

    res.status(200).json({
      success: true,
      referrals,
    })
  } catch (error) {
    console.error("Get admin referral history error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load referral history",
    })
  }
}
