import mongoose, { ClientSession, Types } from "mongoose"

import {
  PREMIUM_MONTHLY_PRICE,
  REFERRAL_MIN_SUCCESSFUL_REFERRALS,
  REFERRAL_MIN_WITHDRAWAL_ETB,
  REFERRAL_REWARD_PERCENTAGE,
  REFERRAL_REWARD_AMOUNT,
} from "../config/pricing"
import { Payment } from "../models/Payment"
import { Referral } from "../models/Referral"
import { ReferralReward } from "../models/ReferralReward"
import {
  ReferralWithdrawal,
  ReferralWithdrawalMethod,
} from "../models/ReferralWithdrawal"
import { User } from "../models/User"

export const getReferralOverview = async (
  rawUserId: string,
  session?: ClientSession,
) => {
  const user = await User.findById(rawUserId)
    .select("referralCode +referralReservedBalance +referralWithdrawnBalance +referralBalanceVersion")
    .session(session || null)
  if (!user) throw new Error("Student account not found")

  const referralQuery = Referral.find({ referrerId: user._id }).sort({ createdAt: -1 }).lean()
  const rewardQuery = ReferralReward.find({ referrerId: user._id }).sort({ createdAt: -1 }).lean()
  const withdrawalQuery = ReferralWithdrawal.find({ userId: user._id }).sort({ createdAt: -1 }).lean()
  const [referralEntries, rewards, withdrawals] = await Promise.all([
    referralQuery.session(session || null),
    rewardQuery.session(session || null),
    withdrawalQuery.session(session || null),
  ])

  const userIds = [...new Set(referralEntries.map((referral) => referral.referredUserId.toString()))]
  const referredUsers = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("name").session(session || null).lean()
    : []
  const usersById = new Map(referredUsers.map((referredUser) => [referredUser._id.toString(), referredUser]))
  const referredPayments = userIds.length
    ? await Payment.find({
        userId: { $in: userIds },
        type: { $in: ["premium", null] },
      })
        .sort({ submittedAt: -1 })
        .select("_id userId amount status submittedAt")
        .session(session || null)
        .lean()
    : []
  const paymentsById = new Map(
    referredPayments.map((payment) => [payment._id.toString(), payment]),
  )
  const approvedPaymentIds = new Set(
    referredPayments
      .filter((payment) => payment.status === "approved")
      .map((payment) => payment._id.toString()),
  )
  const referralUserIds = new Set(userIds)
  const successfulRewards = rewards.filter((reward) => {
    const payment = paymentsById.get(reward.paymentId.toString())
    return (
      referralUserIds.has(reward.referredUserId.toString()) &&
      approvedPaymentIds.has(reward.paymentId.toString()) &&
      payment?.userId.toString() === reward.referredUserId.toString()
    )
  })
  const successfulUserIds = new Set(
    successfulRewards.map((reward) => reward.referredUserId.toString()),
  )
  const successfulPaymentRewardIds = new Set(
    successfulRewards.map((reward) => reward._id.toString()),
  )
  const validRewards = rewards.filter((reward) =>
    successfulPaymentRewardIds.has(reward._id.toString()),
  )
  const paymentByUser = new Map<string, (typeof referredPayments)[number]>()
  for (const payment of referredPayments) {
    if (!paymentByUser.has(payment.userId.toString())) {
      paymentByUser.set(payment.userId.toString(), payment)
    }
  }
  const sumRewards = (status: "pending" | "approved" | "paid") =>
    validRewards
      .filter((reward) => reward.status === status)
      .reduce((total, reward) => total + reward.amount, 0)
  const approvedEarnings = sumRewards("approved")
  const availableRewardCredits = sumRewards("pending") + approvedEarnings
  const reservedBalance = user.referralReservedBalance || 0
  const withdrawnBalance = user.referralWithdrawnBalance || 0
  const availableBalance = Math.max(0, availableRewardCredits - reservedBalance - withdrawnBalance)
  const successfulReferralCount = successfulUserIds.size
  const successfulReferralEarnings = successfulRewards.reduce(
    (total, reward) => total + reward.amount,
    0,
  )
  const withdrawalEligible =
    successfulReferralCount >= REFERRAL_MIN_SUCCESSFUL_REFERRALS &&
    availableBalance >= REFERRAL_MIN_WITHDRAWAL_ETB

  return {
    referralCode: user.referralCode || "",
    referralLink: user.referralCode
      ? `${(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "")}/signup?ref=${user.referralCode}`
      : "",
    totalPeopleInvited: referralEntries.length,
    successfulReferralCount,
    successfulPremiumReferrals: successfulReferralCount,
    successfulReferralEarnings,
    referralRewardPercentage: REFERRAL_REWARD_PERCENTAGE,
    premiumMonthlyPrice: PREMIUM_MONTHLY_PRICE,
    totalEarnings: validRewards.reduce((total, reward) => total + reward.amount, 0),
    pendingRewards: sumRewards("pending"),
    approvedRewards: approvedEarnings,
    paidRewards: sumRewards("paid"),
    availableBalance,
    rewardPerPayment: REFERRAL_REWARD_AMOUNT,
    minimumSuccessfulReferrals: REFERRAL_MIN_SUCCESSFUL_REFERRALS,
    minimumWithdrawalAmount: REFERRAL_MIN_WITHDRAWAL_ETB,
    withdrawalEligible,
    history: referralEntries.flatMap((entry) => {
      const referredUserId = entry.referredUserId.toString()
      const studentName = usersById.get(referredUserId)?.name || "Steady Mate student"
      const studentRewards = validRewards.filter(
        (reward) => reward.referredUserId.toString() === referredUserId,
      )
      if (studentRewards.length > 0) {
        return studentRewards.map((reward) => {
          const payment = paymentsById.get(reward.paymentId.toString())
          return {
            id: reward._id,
            studentName,
            referredAt: payment?.submittedAt || entry.createdAt,
            premiumPaymentStatus: payment?.status || "approved",
            rewardAmount: reward.amount,
            rewardStatus: reward.status,
          }
        })
      }

      const payment = paymentByUser.get(referredUserId)
      return [{
        id: entry._id,
        studentName,
        referredAt: entry.createdAt,
        premiumPaymentStatus: payment?.status || "not_submitted",
        rewardAmount: 0,
        rewardStatus: "not_earned",
      }]
    }),
    withdrawals: withdrawals.map((withdrawal) => ({
      id: withdrawal._id,
      amount: withdrawal.amount,
      status: withdrawal.status,
      paymentMethod: withdrawal.paymentMethod || "unknown",
      bankName: withdrawal.bankName || "",
      accountHolderName: withdrawal.accountHolderName,
      maskedAccountNumber: maskPayoutDetails(withdrawal.accountNumber),
      maskedTelebirrPhone: maskPayoutDetails(withdrawal.telebirrPhone),
      createdAt: withdrawal.createdAt,
      reviewedAt: withdrawal.reviewedAt,
      paidAt: withdrawal.paidAt,
      rejectionReason: withdrawal.rejectionReason,
    })),
  }
}

const maskPayoutDetails = (value?: string): string => {
  if (!value) return ""
  return `****${value.slice(-4)}`
}

export type ReferralWithdrawalDetails = {
  paymentMethod: ReferralWithdrawalMethod
  accountHolderName: string
  bankName?: string
  accountNumber?: string
  telebirrPhone?: string
}

export const createReferralWithdrawal = async (
  rawUserId: string,
  amount: number,
  details: ReferralWithdrawalDetails,
) => {
  if (!mongoose.Types.ObjectId.isValid(rawUserId)) {
    throw new Error("Invalid authenticated user")
  }
  const paymentMethod = details?.paymentMethod
  const accountHolderName = typeof details?.accountHolderName === "string"
    ? details.accountHolderName.trim()
    : ""
  const bankName = typeof details?.bankName === "string" ? details.bankName.trim() : ""
  const accountNumber = typeof details?.accountNumber === "string"
    ? details.accountNumber.trim()
    : ""
  const telebirrPhone = typeof details?.telebirrPhone === "string"
    ? details.telebirrPhone.trim()
    : ""

  if (!["bank_transfer", "telebirr"].includes(paymentMethod)) {
    throw new Error("Select Bank Transfer or Telebirr.")
  }
  if (!accountHolderName || accountHolderName.length > 120) {
    throw new Error("Enter a valid account holder name.")
  }
  if (paymentMethod === "bank_transfer" && (!bankName || bankName.length > 120 || !accountNumber || accountNumber.length > 80)) {
    throw new Error("Enter the bank name and account number.")
  }
  if (paymentMethod === "telebirr" && (!telebirrPhone || telebirrPhone.length > 40)) {
    throw new Error("Enter a valid Telebirr phone number.")
  }

  const session = await mongoose.startSession()
  let createdId: Types.ObjectId | null = null

  try {
    await session.withTransaction(async () => {
      const overview = await getReferralOverview(rawUserId, session)
      if (overview.successfulReferralCount < REFERRAL_MIN_SUCCESSFUL_REFERRALS) {
        throw new Error(
          `You need at least ${REFERRAL_MIN_SUCCESSFUL_REFERRALS} successful Premium referrals before you can withdraw your referral earnings. / ከሪፈራል ገቢዎን ከማውጣትዎ በፊት ቢያንስ ${REFERRAL_MIN_SUCCESSFUL_REFERRALS} የተሳኩ የፕሪሚየም ሪፈራሎች ያስፈልጉዎታል።`,
        )
      }
      if (overview.availableBalance < REFERRAL_MIN_WITHDRAWAL_ETB) {
        throw new Error(`You need at least ${REFERRAL_MIN_WITHDRAWAL_ETB} ETB in available referral earnings to request a withdrawal.`)
      }
      if (!Number.isFinite(amount)) {
        throw new Error("Enter a valid withdrawal amount.")
      }
      if (amount < REFERRAL_MIN_WITHDRAWAL_ETB) {
        throw new Error(
          `Withdrawal amount must be at least ${REFERRAL_MIN_WITHDRAWAL_ETB} ETB.`,
        )
      }
      if (amount > overview.availableBalance) {
        throw new Error("Withdrawal amount cannot exceed your available referral balance.")
      }

      const user = await User.findOneAndUpdate(
        { _id: rawUserId },
        {
          $inc: {
            referralReservedBalance: amount,
            referralBalanceVersion: 1,
          },
        },
        { new: true, session },
      )
      if (!user) throw new Error("Student account not found")

      const [withdrawal] = await ReferralWithdrawal.create(
        [{
          userId: user._id,
          amount,
          status: "pending",
          paymentMethod,
          accountHolderName,
          ...(paymentMethod === "bank_transfer"
            ? { bankName, accountNumber }
            : { telebirrPhone }),
        }],
        { session },
      )
      createdId = withdrawal._id
    })
  } finally {
    await session.endSession()
  }

  if (!createdId) throw new Error("Unable to create withdrawal request")
  return { id: createdId }
}
