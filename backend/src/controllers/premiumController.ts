import { Request, Response } from "express"

import { Payment } from "../models/Payment"
import {
  PREMIUM_MONTHLY_PRICE,
  REFERRAL_MIN_SUCCESSFUL_REFERRALS,
  REFERRAL_MIN_WITHDRAWAL_ETB,
  REFERRAL_REWARD_PERCENTAGE,
  getReferralRewardValue,
} from "../config/pricing"

export const getPremiumPricing = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    premiumPrice: {
      amount: PREMIUM_MONTHLY_PRICE,
      currency: "ETB",
      period: "month",
    },
    referral: {
      rewardPercentage: REFERRAL_REWARD_PERCENTAGE,
      rewardPerCurrentPricePayment: getReferralRewardValue(),
      minimumSuccessfulReferrals: REFERRAL_MIN_SUCCESSFUL_REFERRALS,
      minimumWithdrawalAmount: REFERRAL_MIN_WITHDRAWAL_ETB,
    },
  })
}

export const submitPremiumPayment = async (
  _req: Request,
  res: Response
): Promise<void> => {
  res.status(410).json({
    success: false,
    message: "Submit Premium payment verification through the official Steady Mate Telegram bot.",
  })
}

export const getMyPremiumPayments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }

    const payments = await Payment.find({
      userId: req.userId,
      type: { $in: ["premium", null] },
    })
      .sort({ submittedAt: -1 })
      .select("amount currency status submittedAt reviewedAt rejectionReason")
      .lean()

    res.status(200).json({
      success: true,
      payments: payments.map((payment) => ({
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        submittedAt: payment.submittedAt,
        reviewedAt: payment.reviewedAt,
        rejectionReason: payment.rejectionReason || "",
      })),
    })
  } catch (error) {
    console.error("Get my Premium payments error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load your Premium payment history",
    })
  }
}
