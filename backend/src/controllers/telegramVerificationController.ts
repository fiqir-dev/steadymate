import { Request, Response } from "express"
import crypto from "crypto"

import { User } from "../models/User"
import { Payment } from "../models/Payment"
import { TelegramPaymentSession } from "../models/TelegramPaymentSession"
import {
  REFERRAL_MIN_SUCCESSFUL_REFERRALS,
  REFERRAL_MIN_WITHDRAWAL_ETB,
} from "../config/pricing"
import {
  PREMIUM_PAYMENT_CONFIG,
  TELEGRAM_BOT_USERNAME,
} from "../config/premiumPayment"
import { getReferralOverview } from "../services/referralService"
import {
  answerTelegramCallback,
  sendTelegramMessage,
} from "../services/telegramBotService"
import { configureTelegramWebhook as registerTelegramWebhook } from "../services/telegramWebhookService"

const VERIFICATION_LIFETIME_MS = 10 * 60 * 1000
const REQUEST_COOLDOWN_MS = 60 * 1000

const hashCode = (code: string) =>
  crypto.createHash("sha256").update(code).digest("hex")

type BotLanguage = "en" | "am"

const languageKeyboard = {
  inline_keyboard: [[
    { text: "🇬🇧 English", callback_data: "premium_lang_en" },
    { text: "🇪🇹 Amharic", callback_data: "premium_lang_am" },
  ]],
}

const paymentKeyboard = {
  inline_keyboard: [[
    { text: "🏦 Bank Transfer", callback_data: "premium_method_bank" },
  ], [
    { text: "📱 Telebirr", callback_data: "premium_method_telebirr" },
  ]],
}

const sendPremiumMethodPrompt = async (
  chatId: number,
  language: BotLanguage,
): Promise<void> => {
  await sendTelegramMessage(
    chatId,
    language === "am"
      ? `Steady Mate Premium\nዋጋ: ${PREMIUM_PAYMENT_CONFIG.price} ብር / በወር\n\nየክፍያ ዘዴ ይምረጡ:`
      : `Steady Mate Premium\nPrice: ${PREMIUM_PAYMENT_CONFIG.price} ETB / month\n\nChoose a payment method:`,
    paymentKeyboard,
  )
}

const sendPaymentInstructions = async (
  chatId: number,
  language: BotLanguage,
  method: "bank" | "telebirr",
): Promise<void> => {
  const price = PREMIUM_PAYMENT_CONFIG.price
  if (method === "bank") {
    await sendTelegramMessage(
      chatId,
      language === "am"
        ? `ባንክ: ${PREMIUM_PAYMENT_CONFIG.bankName}\nየሂሳብ ቁጥር: ${PREMIUM_PAYMENT_CONFIG.bankAccountNumber}\nየሂሳብ ስም: ${PREMIUM_PAYMENT_CONFIG.bankAccountName}\n\nእባክዎ ${price} ብር ወደ ከላይ ያለው ሂሳብ ያስተላልፉ፣ ከዚያ የክፍያ መረጃዎን ለማስገባት ይቀጥሉ።\n\nየSteady Mate መለያ ኢሜይልዎ ምንድን ነው?`
        : `Bank: ${PREMIUM_PAYMENT_CONFIG.bankName}\nAccount Number: ${PREMIUM_PAYMENT_CONFIG.bankAccountNumber}\nAccount Name: ${PREMIUM_PAYMENT_CONFIG.bankAccountName}\n\nPlease transfer ${price} ETB to the account above, then continue to submit your payment information.\n\nWhat is your Steady Mate account email?`,
    )
    return
  }

  await sendTelegramMessage(
    chatId,
    language === "am"
      ? `Telebirr: ${PREMIUM_PAYMENT_CONFIG.telebirrPhone}\nየTelebirr መለያ ስም: ${PREMIUM_PAYMENT_CONFIG.telebirrAccountName}\n\nእባክዎ ${price} ብር ወደ ከላይ ያለው የTelebirr ቁጥር ይላኩ፣ ከዚያ የክፍያ መረጃዎን ለማስገባት ይቀጥሉ።\n\nየSteady Mate መለያ ኢሜይልዎ ምንድን ነው?`
      : `Telebirr: ${PREMIUM_PAYMENT_CONFIG.telebirrPhone}\nAccount Name: ${PREMIUM_PAYMENT_CONFIG.telebirrAccountName}\n\nPlease send ${price} ETB to the Telebirr number above, then continue to submit your payment information.\n\nWhat is your Steady Mate account email?`,
  )
}

const getTelegramConfig = () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
})

const isValidWebhookSecret = (secret: string) =>
  /^[A-Za-z0-9_-]{32,256}$/.test(secret)

const isValidWebhookUrl = (url: string) => {
  try {
    return new URL(url).protocol === "https:"
  } catch {
    return false
  }
}

export const getTelegramVerificationStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select("telegramVerified")
    if (!user) {
      res.status(404).json({
        success: false,
        message: "Student account not found",
      })
      return
    }
    res.status(200).json({
      success: true,
      telegramVerified: user.telegramVerified === true,
    })
  } catch (error) {
    console.error("Get Telegram verification status error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to check Telegram verification status",
    })
  }
}

export const createTelegramVerification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { botToken, webhookSecret, webhookUrl } = getTelegramConfig()
    if (
      !botToken ||
      !webhookSecret ||
      !webhookUrl ||
      !isValidWebhookSecret(webhookSecret) ||
      !isValidWebhookUrl(webhookUrl)
    ) {
      res.status(503).json({
        success: false,
        message:
          "Telegram verification is not configured. Add the bot token, webhook URL, and webhook secret to the backend environment.",
      })
      return
    }

    const user = await User.findById(req.userId).select(
      "+telegramVerificationRequestedAt +telegramUserId telegramVerified",
    )
    if (!user) {
      res.status(404).json({
        success: false,
        message: "Student account not found",
      })
      return
    }
    if (user.telegramVerified && user.telegramUserId) {
      res.status(200).json({
        success: true,
        telegramVerified: true,
        message: "Your account is already Telegram verified.",
      })
      return
    }

    const now = new Date()
    const requestedAt = user.telegramVerificationRequestedAt
    if (
      requestedAt &&
      now.getTime() - requestedAt.getTime() < REQUEST_COOLDOWN_MS
    ) {
      res.status(429).json({
        success: false,
        code: "VERIFICATION_COOLDOWN",
        message: "Please wait a moment before requesting another code.",
      })
      return
    }

    const code = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(now.getTime() + VERIFICATION_LIFETIME_MS)
    user.set({
      telegramVerified: false,
      telegramVerificationHash: hashCode(code),
      telegramVerificationExpiresAt: expiresAt,
      telegramVerificationRequestedAt: now,
    })
    await user.save()

    res.status(201).json({
      success: true,
      telegramVerified: false,
      telegramUrl: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`,
      expiresAt,
      message: "Open the official bot and send /start to verify your account.",
    })
  } catch (error) {
    console.error("Create Telegram verification error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to start Telegram verification",
    })
  }
}

export const handleTelegramWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { botToken, webhookSecret } = getTelegramConfig()
  if (!botToken || !webhookSecret) {
    res.status(503).json({
      success: false,
      message: "Telegram webhook is not configured",
    })
    return
  }

  const receivedSecret = req.header("x-telegram-bot-api-secret-token") || ""
  const expectedBuffer = Buffer.from(webhookSecret)
  const receivedBuffer = Buffer.from(receivedSecret)
  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    res.status(401).json({
      success: false,
      message: "Invalid Telegram webhook secret",
    })
    return
  }
  console.info("Telegram webhook received")

  const update = req.body as {
    update_id?: number
    callback_query?: {
      id?: string
      data?: string
      from?: { id?: number }
      message?: { chat?: { id?: number; type?: string } }
    }
    message?: {
      text?: string
      chat?: { id?: number; type?: string }
      from?: { id?: number }
      photo?: Array<{ file_id?: string }>
      document?: { file_id?: string; mime_type?: string }
    }
  }
  const text = update?.message?.text?.trim() || ""
  const callback = update.callback_query
  const chatId = update?.message?.chat?.id ?? callback?.message?.chat?.id
  const telegramUserId = update?.message?.from?.id ?? callback?.from?.id
  const chatType = update?.message?.chat?.type ?? callback?.message?.chat?.type
  const match = text.match(/^\/start(?:@\w+)?\s+([a-fA-F0-9]{64})$/)

  if (typeof chatId !== "number" || typeof telegramUserId !== "number") {
    res.status(200).json({ success: true })
    return
  }

  try {
    if (callback?.data === "referral_withdraw_min" && callback.id) {
      try {
        const linkedUser = await User.findOne({
          telegramUserId: String(telegramUserId),
          telegramVerified: true,
        }).select("_id")
        if (!linkedUser) {
          await answerTelegramCallback(callback.id, "Link your verified Telegram account from your Steady Mate profile first.")
        } else {
          await answerTelegramCallback(callback.id, "Choose your payout method on the referral page.")
          const referralUrl = `${(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "")}/referrals`
          await sendTelegramMessage(
            chatId,
            `To submit a withdrawal, open your referral page and choose Bank Transfer or Telebirr:\n${referralUrl}`,
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to request withdrawal"
        await answerTelegramCallback(callback.id, message.slice(0, 180))
      }
      res.status(200).json({ success: true })
      return
    }

    if (match) {
      const codeHash = hashCode(match[1])
      const user = await User.findOneAndUpdate(
        {
          telegramVerificationHash: codeHash,
          telegramVerificationExpiresAt: { $gt: new Date() },
          telegramVerified: { $ne: true },
        },
        {
          $set: { telegramVerified: true },
          $unset: {
            telegramVerificationHash: "",
            telegramVerificationExpiresAt: "",
            telegramVerificationRequestedAt: "",
          },
        },
        { new: true },
      ).select("_id")

      if (user) {
        await User.updateOne(
          { _id: user._id },
          { $set: { telegramUserId: String(telegramUserId) } },
        )
      }

      const message = user
        ? "Your Steady Mate account is now verified. You can return to the app."
        : "This verification link is invalid or has expired. Request a new one from your Steady Mate account."
      await sendTelegramMessage(chatId, message)
      res.status(200).json({ success: true })
      return
    }

    if (chatType !== "private") {
      res.status(200).json({ success: true })
      return
    }

    if (callback?.id && callback.data?.startsWith("premium_lang_")) {
      const language = callback.data === "premium_lang_am" ? "am" : "en"
      const session = await TelegramPaymentSession.findOneAndUpdate(
        { chatId: String(chatId), telegramUserId: String(telegramUserId) },
        {
          $set: {
            language,
            userId: null,
            email: "",
            studentName: "",
            paymentMethod: null,
            step: "awaiting_payment_method",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      await answerTelegramCallback(
        callback.id,
        language === "am" ? "ቋንቋ ተመርጧል" : "Language selected",
      )
      await sendPremiumMethodPrompt(chatId, session.language || language)
      res.status(200).json({ success: true })
      return
    }

    if (callback?.id && callback.data?.startsWith("premium_method_")) {
      const method = callback.data === "premium_method_bank" ? "bank" : "telebirr"
      const session = await TelegramPaymentSession.findOne({
        chatId: String(chatId),
        telegramUserId: String(telegramUserId),
        step: "awaiting_payment_method",
      })
      if (!session) {
        await answerTelegramCallback(
          callback.id,
          "Send /start to begin a new payment request.",
        )
        res.status(200).json({ success: true })
        return
      }
      session.paymentMethod = method
      session.step = "awaiting_email"
      await session.save()
      await answerTelegramCallback(
        callback.id,
        session.language === "am" ? "የክፍያ ዘዴ ተመርጧል" : "Payment method selected",
      )
      await sendPaymentInstructions(
        chatId,
        session.language || "en",
        method,
      )
      res.status(200).json({ success: true })
      return
    }

    if (/^\/start(?:@\w+)?$/i.test(text)) {
      await TelegramPaymentSession.findOneAndUpdate(
        { chatId: String(chatId) },
        {
          $set: {
            telegramUserId: String(telegramUserId),
            userId: null,
            email: "",
            studentName: "",
            language: "en",
            paymentMethod: null,
            step: "awaiting_language",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      await sendTelegramMessage(
        chatId,
        "Choose your language / ቋንቋዎን ይምረጡ",
        languageKeyboard,
      )
      res.status(200).json({ success: true })
      return
    }

    if (/^\/cancel(?:@\w+)?$/i.test(text)) {
      const currentSession = await TelegramPaymentSession.findOne({
        chatId: String(chatId),
        telegramUserId: String(telegramUserId),
      }).select("language")
      await TelegramPaymentSession.deleteOne({
        chatId: String(chatId),
        telegramUserId: String(telegramUserId),
      })
      await sendTelegramMessage(
        chatId,
        currentSession?.language === "am"
          ? "የአሁኑ የክፍያ ጥያቄዎ ተሰርዟል። እንደገና ለመጀመር /start ይላኩ።"
          : "Your current payment request was cancelled. Send /start when you are ready to begin again.",
      )
      res.status(200).json({ success: true })
      return
    }

    if (/^\/help(?:@\w+)?$/i.test(text)) {
      const currentSession = await TelegramPaymentSession.findOne({
        chatId: String(chatId),
        telegramUserId: String(telegramUserId),
      }).select("language")
      await sendTelegramMessage(
        chatId,
        currentSession?.language === "am"
          ? "የSteady Mate Premium ክፍያ እገዛ\n\n/start - የክፍያ ጥያቄ ይጀምሩ\n/cancel - የአሁኑን ጥያቄ ይሰርዙ\n\nቋንቋ ይምረጡ፣ ባንክ ወይም Telebirr ይምረጡ፣ ከዚያ ኢሜይልዎን፣ ሙሉ ስምዎን እና የክፍያ ስክሪንሾትዎን ያስገቡ። አስተዳዳሪ እስኪያጸድቀው ድረስ Premium አይነቃም።"
          : "Steady Mate Premium payment help\n\n/start - start a payment request\n/cancel - cancel the current request\n\nChoose English or Amharic, select Bank Transfer or Telebirr, then provide your account email, full name, and payment screenshot. An admin reviews every payment; Premium is not activated before approval.",
      )
      res.status(200).json({ success: true })
      return
    }

    const referralCommand = /^\/referral(?:@\w+)?$/i.test(text)
    const withdrawalCommand = text.match(/^\/withdraw(?:@\w+)?\s+(\d+(?:\.\d{1,2})?)$/i)
    if (referralCommand || withdrawalCommand) {
      const linkedUser = await User.findOne({
        telegramUserId: String(telegramUserId),
        telegramVerified: true,
      }).select("_id")
      if (!linkedUser) {
        await sendTelegramMessage(
          chatId,
          "Link your Telegram account from your signed-in Steady Mate profile before checking referral earnings. Never send your password.",
        )
        res.status(200).json({ success: true })
        return
      }

      if (withdrawalCommand) {
        const referralUrl = `${(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "")}/referrals`
        await sendTelegramMessage(
          chatId,
          `Withdrawals must be submitted from your referral page so you can select Bank Transfer or Telebirr and provide payout details:\n${referralUrl}`,
        )
        res.status(200).json({ success: true })
        return
      }

      const referral = await getReferralOverview(linkedUser._id.toString())
      const lockedByCount = referral.successfulReferralCount < REFERRAL_MIN_SUCCESSFUL_REFERRALS
      const remaining = Math.max(
        0,
        REFERRAL_MIN_SUCCESSFUL_REFERRALS - referral.successfulReferralCount,
      )
      const status = referral.withdrawalEligible
        ? "✅ Unlocked"
        : "🔒 Locked"
      const details = referral.withdrawalEligible
        ? "Open the referral page to request a withdrawal and select Bank Transfer or Telebirr."
        : lockedByCount
          ? `Invite ${remaining} more successful Premium user${remaining === 1 ? "" : "s"} to unlock withdrawals.`
          : `You need at least ${REFERRAL_MIN_WITHDRAWAL_ETB} ETB available.`
      await sendTelegramMessage(
        chatId,
        `💰 Referral Earnings\n\nReward per successful Premium referral:\n${referral.rewardPerPayment} ETB\n\nSuccessful referrals:\n${referral.successfulReferralCount} / ${REFERRAL_MIN_SUCCESSFUL_REFERRALS}\n\nAvailable balance:\n${referral.availableBalance} ETB\n\nWithdrawal:\n${status}\n\n${details}`,
        referral.withdrawalEligible
          ? {
              inline_keyboard: [[{
                text: "Withdraw Earnings",
                callback_data: "referral_withdraw_min",
              }]],
            }
          : undefined,
      )
      res.status(200).json({ success: true })
      return
    }

    const messagePhoto = update.message?.photo
    const document = update.message?.document
    const screenshotFileId =
      messagePhoto?.[messagePhoto.length - 1]?.file_id ||
      (document?.mime_type?.startsWith("image/") ? document.file_id : undefined)
    const session = await TelegramPaymentSession.findOne({
      chatId: String(chatId),
      telegramUserId: String(telegramUserId),
    })

    if (!session) {
      await sendTelegramMessage(chatId, "To submit a Premium payment, start by sending /start.")
      res.status(200).json({ success: true })
      return
    }

    if (session.step === "awaiting_email") {
      const email = text.toLowerCase().trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await sendTelegramMessage(
          chatId,
          session.language === "am"
            ? "እባክዎ ትክክለኛ የኢሜይል አድራሻ ያስገቡ።"
            : "Please send a valid email address for your Steady Mate account.",
        )
        res.status(200).json({ success: true })
        return
      }

      const user = await User.findOne({ email }).select(
        "_id email name",
      )
      if (!user) {
        await sendTelegramMessage(
          chatId,
          session.language === "am"
            ? "ይህን ኢሜይል የያዘ የSteady Mate መለያ ማግኘት አልቻልንም። እባክዎ ከSteady Mate መለያዎ ጋር የተያያዘውን ኢሜይል ይጠቀሙ።"
            : "We couldn't find a Steady Mate account with this email. Please use the email from your Steady Mate account.",
        )
        res.status(200).json({ success: true })
        return
      }

      session.userId = user._id
      session.email = user.email
      session.step = "awaiting_name"
      await session.save()
      await sendTelegramMessage(
        chatId,
        session.language === "am"
          ? "ሙሉ ስምዎ ማን ነው?"
          : "What is your full name?",
      )
      res.status(200).json({ success: true })
      return
    }

    if (session.step === "awaiting_name") {
      const studentName = text.trim()
      if (studentName.length < 2 || studentName.length > 120) {
        await sendTelegramMessage(
          chatId,
          session.language === "am"
            ? "እባክዎ ትክክለኛ ሙሉ ስም ያስገቡ።"
            : "Please enter a valid full name.",
        )
        res.status(200).json({ success: true })
        return
      }
      session.studentName = studentName
      session.step = "awaiting_screenshot"
      await session.save()
      await sendTelegramMessage(
        chatId,
        session.language === "am"
          ? `እባክዎ የ${PREMIUM_PAYMENT_CONFIG.price} ብር ክፍያ ደረሰኝ ስክሪንሾት ይላኩ።`
          : `Please send a screenshot of your ${PREMIUM_PAYMENT_CONFIG.price} ETB payment receipt.`,
      )
      res.status(200).json({ success: true })
      return
    }

    if (session.step === "awaiting_screenshot" && screenshotFileId && session.userId && session.email) {
      const existingPending = await Payment.findOne({
        userId: session.userId,
        type: "premium",
        status: "pending",
      }).select("_id")

      if (existingPending) {
        session.step = "complete"
        await session.save()
        await sendTelegramMessage(
          chatId,
          session.language === "am"
            ? "የPremium ክፍያ ጥያቄዎ አስቀድሞ የአስተዳዳሪ ግምገማ እየጠበቀ ነው።"
            : "You already have a Premium payment waiting for admin review. We will notify you after it has been reviewed.",
        )
        res.status(200).json({ success: true })
        return
      }

      try {
        await Payment.create({
          userId: session.userId,
          studentName: session.studentName,
          email: session.email,
          telegramUserId: String(telegramUserId),
          telegramChatId: String(chatId),
          telegramFileId: screenshotFileId,
          telegramUpdateId: update.update_id,
          paymentMethod: session.paymentMethod,
          amount: PREMIUM_PAYMENT_CONFIG.price,
          currency: "ETB",
          type: "premium",
          status: "pending",
          submittedAt: new Date(),
        })
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) {
          throw error
        }
      }

      session.step = "complete"
      await session.save()
      await sendTelegramMessage(
        chatId,
        session.language === "am"
          ? `ክፍያ ቀርቧል ✓\nየPremium ክፍያዎ ለማረጋገጫ ቀርቧል።\n\nመጠን: ${PREMIUM_PAYMENT_CONFIG.price} ብር\nዘዴ: ${session.paymentMethod === "bank" ? "ባንክ" : "Telebirr"}\nሁኔታ: በመጠባበቅ ላይ\n\nአስተዳዳሪያችን ክፍያዎን ይገመግማል።`
          : `Payment submitted ✓\nYour Premium payment has been submitted for verification.\n\nAmount: ${PREMIUM_PAYMENT_CONFIG.price} ETB\nMethod: ${session.paymentMethod === "bank" ? "Bank" : "Telebirr"}\nStatus: Pending\n\nOur admin will review your payment.`,
      )
      res.status(200).json({ success: true })
      return
    }

    if (session.step === "complete") {
      await sendTelegramMessage(chatId, "Your payment submission is recorded. Send /start to begin a new verification request.")
    } else if (session.step === "awaiting_screenshot") {
      await sendTelegramMessage(chatId, "Please send a payment screenshot as an image.")
    }
    res.status(200).json({ success: true })
  } catch {
    console.error("Telegram update processing failed")
    res.status(500).json({
      success: false,
      message: "Unable to process Telegram verification",
    })
  }
}

export const configureTelegramWebhook = async (): Promise<void> => {
  await registerTelegramWebhook()
}
