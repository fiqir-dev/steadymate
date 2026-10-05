import crypto from "crypto"

import { User } from "../models/User"
import { Payment } from "../models/Payment"
import { ReferralReward } from "../models/ReferralReward"
import { REFERRAL_REWARD_PERCENTAGE, getReferralRewardValue } from "../config/pricing"

const isDuplicateKeyError = (error: unknown): boolean =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  error.code === 11000

export const ensureExistingUsersHaveReferralCodes = async (): Promise<void> => {
  const users = User.find({
    $or: [
      { referralCode: { $exists: false } },
      { referralCode: null },
      { referralCode: "" },
    ],
  })
    .select("_id")
    .cursor()

  for await (const user of users) {
    let assigned = false
    for (let attempt = 0; attempt < 5 && !assigned; attempt += 1) {
      try {
        const code = crypto.randomBytes(6).toString("hex").toUpperCase()
        const result = await User.updateOne(
          { _id: user._id, $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: "" }] },
          { $set: { referralCode: code } },
        )
        assigned = result.modifiedCount === 1
        if (!assigned) {
          assigned = Boolean(await User.exists({ _id: user._id, referralCode: { $ne: "" } }))
        }

      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error
      }
    }

    if (!assigned) {
      throw new Error(`Unable to assign a unique referral code to user ${user._id}`)
    }
  }
}

export const migrateReferralRewardValues = async (): Promise<void> => {
  const rewards = ReferralReward.find({
    percentage: { $ne: REFERRAL_REWARD_PERCENTAGE },
  })
    .select("paymentId amount percentage")
    .cursor()
  for await (const reward of rewards) {
    const payment = await Payment.findById(reward.paymentId).select("amount")
    if (!payment) continue
    const amount = getReferralRewardValue(payment.amount)
    if (
      reward.amount !== amount ||
      reward.percentage !== REFERRAL_REWARD_PERCENTAGE
    ) {
      await ReferralReward.updateOne(
        { _id: reward._id },
        { $set: { amount, percentage: REFERRAL_REWARD_PERCENTAGE } },
      )
    }
  }
}
