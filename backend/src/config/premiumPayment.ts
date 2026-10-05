import { PREMIUM_MONTHLY_PRICE } from "./pricing"

export const PREMIUM_PAYMENT_CONFIG = {
  price: PREMIUM_MONTHLY_PRICE,
  bankName: process.env.PREMIUM_BANK_NAME || "CBE",
  bankAccountNumber: process.env.PREMIUM_BANK_ACCOUNT_NUMBER || "1000000000",
  bankAccountName: process.env.PREMIUM_BANK_ACCOUNT_NAME || "Steady Mate",
  telebirrPhone: process.env.PREMIUM_TELEBIRR_PHONE || "0989259319",
  telebirrAccountName: process.env.PREMIUM_TELEBIRR_ACCOUNT_NAME || "Steady Mate",
}

export const TELEGRAM_BOT_USERNAME =
  process.env.TELEGRAM_BOT_USERNAME || "steadymatesupport_bot"
