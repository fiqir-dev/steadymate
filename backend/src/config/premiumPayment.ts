import { PREMIUM_MONTHLY_PRICE } from "./pricing"

export const PREMIUM_PAYMENT_CONFIG = {
  price: PREMIUM_MONTHLY_PRICE,
  bankName: process.env.PREMIUM_BANK_NAME?.trim() || "",
  bankAccountNumber: process.env.PREMIUM_BANK_ACCOUNT_NUMBER?.trim() || "",
  bankAccountName: process.env.PREMIUM_BANK_ACCOUNT_NAME?.trim() || "",
  telebirrPhone: process.env.PREMIUM_TELEBIRR_PHONE?.trim() || "",
  telebirrAccountName: process.env.PREMIUM_TELEBIRR_ACCOUNT_NAME?.trim() || "",
}

export const getMissingPremiumPaymentConfig = (): string[] =>
  [
    ["PREMIUM_BANK_NAME", PREMIUM_PAYMENT_CONFIG.bankName],
    ["PREMIUM_BANK_ACCOUNT_NUMBER", PREMIUM_PAYMENT_CONFIG.bankAccountNumber],
    ["PREMIUM_BANK_ACCOUNT_NAME", PREMIUM_PAYMENT_CONFIG.bankAccountName],
    ["PREMIUM_TELEBIRR_PHONE", PREMIUM_PAYMENT_CONFIG.telebirrPhone],
    ["PREMIUM_TELEBIRR_ACCOUNT_NAME", PREMIUM_PAYMENT_CONFIG.telebirrAccountName],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key)

export const TELEGRAM_BOT_USERNAME =
  process.env.TELEGRAM_BOT_USERNAME || "steadymatesupport_bot"
