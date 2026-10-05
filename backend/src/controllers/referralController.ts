import { Request, Response } from "express"

import { createReferralWithdrawal, getReferralOverview } from "../services/referralService"

export const getMyReferrals = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }
    const referral = await getReferralOverview(req.userId)
    res.status(200).json({ success: true, referral })
  } catch (error) {
    console.error("Get my referrals error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load referral information",
    })
  }
}

export const requestReferralWithdrawal = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }
    const amount = Number(req.body?.amount)
    const withdrawal = await createReferralWithdrawal(req.userId, amount, {
      paymentMethod: req.body?.paymentMethod,
      accountHolderName: req.body?.accountHolderName,
      bankName: req.body?.bankName,
      accountNumber: req.body?.accountNumber,
      telebirrPhone: req.body?.telebirrPhone,
    })
    res.status(201).json({
      success: true,
      message: "Referral withdrawal request received and is pending admin review.",
      withdrawal: { id: withdrawal.id, amount, status: "pending" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request withdrawal"
    const status = message.startsWith("You need at least") ||
      message.startsWith("Withdrawal amount") ||
    message.startsWith("Enter a valid") ||
    message.startsWith("Enter the") ||
    message.startsWith("Select")
      ? 400
      : 500
    if (status === 500) console.error("Request referral withdrawal error:", error)
    res.status(status).json({ success: false, message })
  }
}

export const getMyReferralWithdrawals = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: "Authentication required" })
      return
    }
    const { withdrawals } = await getReferralOverview(req.userId)
    res.status(200).json({ success: true, withdrawals })
  } catch (error) {
    console.error("Get my referral withdrawals error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load referral withdrawal history",
    })
  }
}

export const getReferralStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await getMyReferrals(req, res)
}
