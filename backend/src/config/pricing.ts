export const PREMIUM_MONTHLY_PRICE = 300
export const REFERRAL_REWARD_PERCENTAGE = 30
export const REFERRAL_MIN_SUCCESSFUL_REFERRALS = 5
export const REFERRAL_MIN_WITHDRAWAL_ETB = 450
export const PREMIUM_DURATION_DAYS = 30

export const PREMIUM_PRICE = PREMIUM_MONTHLY_PRICE
export const REFERRAL_PERCENTAGE = REFERRAL_REWARD_PERCENTAGE
export const getReferralRewardValue = (
  paymentAmount = PREMIUM_MONTHLY_PRICE,
): number =>
  Number(((paymentAmount * REFERRAL_REWARD_PERCENTAGE) / 100).toFixed(2))

export const REFERRAL_REWARD_AMOUNT = getReferralRewardValue()
