
import { Request, Response } from "express"
import crypto from "crypto"

import { User } from "../models/User"
import { Payment } from "../models/Payment"
import { TelegramPaymentSession } from "../models/TelegramPaymentSession"
import { TelegramSupportTicket } from "../models/TelegramSupportTicket"

import {
  REFERRAL_MIN_SUCCESSFUL_REFERRALS,
  REFERRAL_MIN_WITHDRAWAL_ETB,
} from "../config/pricing"

import {
  getMissingPremiumPaymentConfig,
  PREMIUM_PAYMENT_CONFIG,
  TELEGRAM_BOT_USERNAME,
} from "../config/premiumPayment"

import { getReferralOverview } from "../services/referralService"

import {
  answerTelegramCallback,
  getTelegramFile,
  sendTelegramMessage,
} from "../services/telegramBotService"

import {
  deletePaymentScreenshot,
  uploadPaymentScreenshot,
} from "../services/cloudinaryService"

import {
  configureTelegramWebhook as registerTelegramWebhook,
} from "../services/telegramWebhookService"

import { getFrontendOrigin } from "../config/frontendUrl"

const VERIFICATION_LIFETIME_MS = 10 * 60 * 1000
const REQUEST_COOLDOWN_MS = 60 * 1000
const SUPPORT_PENDING_PREFIX = "[AWAITING_STUDENT_MESSAGE]"

type BotLanguage = "en" | "am"
type SupportType =
  | "bug_report"
  | "complaint"
  | "feedback"
  | "suggestion"
  | "payment_problem"

const hashCode = (code: string) =>
  crypto.createHash("sha256").update(code).digest("hex")

const getAdminChatId = () =>
  process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || ""

const reportPremiumPaymentConfiguration = async (): Promise<boolean> => {
  const missing = getMissingPremiumPaymentConfig()
  if (!missing.length) return true

  const adminChatId = getAdminChatId()
  console.error("Premium payment configuration is incomplete", { missing })
  if (adminChatId && /^-?\d+$/.test(adminChatId)) {
    try {
      await sendTelegramMessage(
        Number(adminChatId),
        `⚠️ Premium payment configuration is incomplete.\n\nMissing variables:\n${missing.join("\n")}\n\nNo payment instructions were shown to students.`,
      )
    } catch (error) {
      console.error(
        "Unable to notify Telegram admin about Premium configuration",
        error instanceof Error ? error.message : "Unknown error",
      )
    }
  }
  return false
}

const supportTypeLabels: Record<SupportType, string> = {
  bug_report: "Bug report",
  complaint: "Complaint",
  feedback: "Feedback",
  suggestion: "Feature suggestion",
  payment_problem: "Payment problem",
}

const isSupportType = (value: unknown): value is SupportType =>
  value === "bug_report" ||
  value === "complaint" ||
  value === "feedback" ||
  value === "suggestion" ||
  value === "payment_problem"

const logPaymentScreenshotError = (
  event: string,
  error: unknown,
  telegramFileId: string,
): void => {
  const errorMessage =
    error instanceof Error ? error.message : "Unknown error"

  const safeErrorMessage = [
    process.env.CLOUDINARY_API_SECRET,
    process.env.CLOUDINARY_API_KEY,
    process.env.TELEGRAM_BOT_TOKEN,
    telegramFileId,
  ]
    .filter((secret): secret is string => Boolean(secret))
    .reduce(
      (message, secret) =>
        message.split(secret).join("[REDACTED]"),
      errorMessage,
    )

  console.error("[telegram-payment-screenshot]", {
    event,
    errorName:
      error instanceof Error ? error.name : "UnknownError",
    errorMessage: safeErrorMessage,
  })
}

const languageKeyboard = {
  inline_keyboard: [[
    {
      text: "🇬🇧 English",
      callback_data: "premium_lang_en",
    },
    {
      text: "🇪🇹 Amharic",
      callback_data: "premium_lang_am",
    },
  ]],
}

const paymentKeyboard = {
  inline_keyboard: [[
    {
      text: "🏦 Bank Transfer",
      callback_data: "premium_method_bank",
    },
  ], [
    {
      text: "📱 Telebirr",
      callback_data: "premium_method_telebirr",
    },
  ]],
}

const mainMenuKeyboard = {
  inline_keyboard: [
    [{
      text: "🌐 Explore Steady Mate",
      url: getFrontendOrigin(),
    }],
    [{
      text: "⭐ Get Premium",
      callback_data: "menu_premium",
    }],
    [{
      text: "📝 Feedback & Complaints",
      callback_data: "menu_feedback",
    }],
    [
      {
        text: "❓ Help & FAQ",
        callback_data: "menu_help",
      },
      {
        text: "🎁 Referral Program",
        callback_data: "menu_referrals",
      },
    ],
  ],
}

const sendMainMenu = async (
  chatId: number,
): Promise<void> => {
  await sendTelegramMessage(
    chatId,
    `🎓 Welcome to Steady Mate!

Your companion for smarter studying. Choose an option below to explore our study tools, manage Premium, or get support.`,
    mainMenuKeyboard,
  )
}

const feedbackMenuKeyboard = {
  inline_keyboard: [
    [{
      text: "🐞 Bug Report",
      callback_data: "support_bug_report",
    }],
    [{
      text: "💳 Payment Problem",
      callback_data: "support_payment_problem",
    }],
    [{
      text: "📣 Complaint",
      callback_data: "support_complaint",
    }],
    [{
      text: "💡 Suggestion",
      callback_data: "support_suggestion",
    }],
    [{
      text: "⬅️ Back to Main Menu",
      callback_data: "menu_main",
    }],
  ],
}

const helpMenuKeyboard = {
  inline_keyboard: [[{
    text: "⬅️ Back to Main Menu",
    callback_data: "menu_main",
  }]],
}

const sendPremiumMethodPrompt = async (
  chatId: number,
  language: BotLanguage,
): Promise<void> => {
  await sendTelegramMessage(
    chatId,
    language === "am"
      ? `Steady Mate Premium
ዋጋ: ${PREMIUM_PAYMENT_CONFIG.price} ብር / በወር

የክፍያ ዘዴ ይምረጡ:`
      : `Steady Mate Premium
Price: ${PREMIUM_PAYMENT_CONFIG.price} ETB / month

Choose a payment method:`,
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
        ? `ባንክ: ${PREMIUM_PAYMENT_CONFIG.bankName}
የሂሳብ ቁጥር: ${PREMIUM_PAYMENT_CONFIG.bankAccountNumber}
የሂሳብ ስም: ${PREMIUM_PAYMENT_CONFIG.bankAccountName}

እባክዎ ${price} ብር ወደ ከላይ ያለው ሂሳብ ያስተላልፉ።

የSteady Mate መለያ ኢሜይልዎ ምንድን ነው?`
        : `🏦 Bank Transfer
Bank: ${PREMIUM_PAYMENT_CONFIG.bankName}
Account name: ${PREMIUM_PAYMENT_CONFIG.bankAccountName}
Account number: ${PREMIUM_PAYMENT_CONFIG.bankAccountNumber}

Please transfer ${price} ETB to this account.

What is your Steady Mate account email?`,
    )
    return
  }

  await sendTelegramMessage(
    chatId,
    language === "am"
      ? `Telebirr: ${PREMIUM_PAYMENT_CONFIG.telebirrPhone}
የTelebirr መለያ ስም: ${PREMIUM_PAYMENT_CONFIG.telebirrAccountName}

እባክዎ ${price} ብር ይላኩ።

የSteady Mate መለያ ኢሜይልዎ ምንድን ነው?`
      : `📱 Telebirr
Account name: ${PREMIUM_PAYMENT_CONFIG.telebirrAccountName}
Phone: ${PREMIUM_PAYMENT_CONFIG.telebirrPhone}

Please send ${price} ETB to this number.

What is your Steady Mate account email?`,
  )
}

const startSupportRequest = async (
  chatId: number,
  telegramUserId: number,
  type: SupportType,
  username?: string,
): Promise<void> => {
  // Remove an unfinished request of the same conversation.
  await TelegramSupportTicket.deleteMany({
    telegramUserId: String(telegramUserId),
    chatId: String(chatId),
    message: SUPPORT_PENDING_PREFIX,
  })

  await TelegramSupportTicket.create({
    telegramUserId: String(telegramUserId),
    chatId: String(chatId),
    username,
    type,
    message: SUPPORT_PENDING_PREFIX,
    status: "open",
  })

  await sendTelegramMessage(
    chatId,
    `📝 ${supportTypeLabels[type]}

Please send your message in your next message.

You can explain a problem, share feedback, or suggest a new feature.

Maximum length: 3,000 characters.

Send /cancel to cancel.`,
  )
}

const notifySupportAdmin = async (
  ticketId: string,
  type: SupportType,
  telegramUserId: number,
  username: string | undefined,
  message: string,
): Promise<void> => {
  const adminChatId = getAdminChatId()

  if (!adminChatId || !/^-?\d+$/.test(adminChatId)) {
    console.error(
      "Support notification unavailable: configure TELEGRAM_ADMIN_CHAT_ID",
    )
    return
  }

  await sendTelegramMessage(
    Number(adminChatId),
    `📩 New Steady Mate support ticket

Ticket: ${ticketId}
Type: ${supportTypeLabels[type]}
Telegram user ID: ${telegramUserId}
Username: ${username ? `@${username}` : "Not provided"}

Message:
${message}`,
  )
}

const notifyPendingPaymentAdmin = async (
  paymentId: string,
  studentName: string,
  email: string,
  method: "bank" | "telebirr" | undefined,
): Promise<void> => {
  const adminChatId = getAdminChatId()
  if (!adminChatId || !/^-?\d+$/.test(adminChatId)) {
    console.error("Payment notification unavailable: configure TELEGRAM_ADMIN_CHAT_ID")
    return
  }

  try {
    await sendTelegramMessage(
      Number(adminChatId),
      `💳 New Premium payment pending review\n\nPayment: ${paymentId}\nStudent: ${studentName}\nEmail: ${email}\nMethod: ${method === "bank" ? "Bank Transfer" : "Telebirr"}\nAmount: ${PREMIUM_PAYMENT_CONFIG.price} ETB\n\nReview it in the authorized admin workspace. Do not approve from Telegram.`,
    )
  } catch (error) {
    console.error(
      "Unable to notify Telegram admin about pending payment",
      error instanceof Error ? error.message : "Unknown error",
    )
  }
}

const sendReferralInformation = async (
  chatId: number,
  telegramUserId: number,
): Promise<void> => {
  const linkedUser = await User.findOne({
    telegramUserId: String(telegramUserId),
    telegramVerified: true,
  }).select("_id")

  if (!linkedUser) {
    await sendTelegramMessage(
      chatId,
      "Link your Telegram account from your signed-in Steady Mate profile before checking referral earnings. Never send your password.",
    )
    return
  }

  const referral = await getReferralOverview(linkedUser._id.toString())
  const lockedByCount =
    referral.successfulReferralCount < REFERRAL_MIN_SUCCESSFUL_REFERRALS
  const remaining = Math.max(
    0,
    REFERRAL_MIN_SUCCESSFUL_REFERRALS - referral.successfulReferralCount,
  )
  const status = referral.withdrawalEligible ? "✅ Unlocked" : "🔒 Locked"
  const details = referral.withdrawalEligible
    ? "Open the referral page to request a withdrawal."
    : lockedByCount
      ? `Invite ${remaining} more successful Premium user${remaining === 1 ? "" : "s"} to unlock withdrawals.`
      : `You need at least ${REFERRAL_MIN_WITHDRAWAL_ETB} ETB available.`

  await sendTelegramMessage(
    chatId,
    `💰 Referral Earnings

Reward per successful Premium referral:
${referral.rewardPerPayment} ETB

Successful referrals:
${referral.successfulReferralCount} / ${REFERRAL_MIN_SUCCESSFUL_REFERRALS}

Available balance:
${referral.availableBalance} ETB

Withdrawal:
${status}

${details}`,
    referral.withdrawalEligible
      ? {
          inline_keyboard: [
            [{
              text: "Withdraw Earnings",
              callback_data: "referral_withdraw_min",
            }],
            [{
              text: "⬅️ Back to Main Menu",
              callback_data: "menu_main",
            }],
          ],
        }
      : {
          inline_keyboard: [[{
            text: "⬅️ Back to Main Menu",
            callback_data: "menu_main",
          }]],
        },
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
    const user = await User.findById(req.userId)
      .select("telegramVerified")

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
    const { botToken, webhookSecret, webhookUrl } =
      getTelegramConfig()

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
          "Telegram verification is not configured. Check the backend environment.",
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
      now.getTime() - requestedAt.getTime() <
        REQUEST_COOLDOWN_MS
    ) {
      res.status(429).json({
        success: false,
        code: "VERIFICATION_COOLDOWN",
        message: "Please wait before requesting another code.",
      })
      return
    }

    const code = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(
      now.getTime() + VERIFICATION_LIFETIME_MS,
    )

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
      message:
        "Open the official bot and send /start to verify your account.",
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

  const receivedSecret =
    req.header("x-telegram-bot-api-secret-token") || ""

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

  const update = req.body as {
    update_id?: number
    callback_query?: {
      id?: string
      data?: string
      from?: {
        id?: number
        first_name?: string
        username?: string
      }
      message?: {
        chat?: {
          id?: number
          type?: string
        }
      }
    }
    message?: {
      text?: string
      chat?: {
        id?: number
        type?: string
      }
      from?: {
        id?: number
        first_name?: string
        username?: string
      }
      photo?: Array<{ file_id?: string }>
      document?: {
        file_id?: string
        mime_type?: string
      }
    }
  }

  const text = update?.message?.text?.trim() || ""
  const callback = update.callback_query

  const chatId =
    update?.message?.chat?.id ??
    callback?.message?.chat?.id

  const telegramUserId =
    update?.message?.from?.id ??
    callback?.from?.id

  const chatType =
    update?.message?.chat?.type ??
    callback?.message?.chat?.type

  const match = text.match(
    /^\/start(?:@\w+)?\s+([a-fA-F0-9]{64})$/,
  )

  if (
    typeof chatId !== "number" ||
    typeof telegramUserId !== "number"
  ) {
    res.status(200).json({ success: true })
    return
  }

  try {
    // Telegram account verification links.
    if (match) {
      const codeHash = hashCode(match[1])

      const user = await User.findOneAndUpdate(
        {
          telegramVerificationHash: codeHash,
          telegramVerificationExpiresAt: {
            $gt: new Date(),
          },
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
          {
            $set: {
              telegramUserId: String(telegramUserId),
            },
          },
        )
      }

      await sendTelegramMessage(
        chatId,
        user
          ? "Your Steady Mate account is now verified. You can return to the app."
          : "This verification link is invalid or has expired. Request a new one from your Steady Mate account.",
      )

      res.status(200).json({ success: true })
      return
    }

    if (chatType !== "private") {
      res.status(200).json({ success: true })
      return
    }

    // Main menu buttons.
    if (
      callback?.id &&
      callback.data?.startsWith("menu_")
    ) {
      const action = callback.data

      if (action === "menu_premium") {
        if (!(await reportPremiumPaymentConfiguration())) {
          await answerTelegramCallback(callback.id, "Premium payment is temporarily unavailable.")
          await sendTelegramMessage(chatId, "Premium payment instructions are temporarily unavailable. Please try again later.")
          res.status(200).json({ success: true })
          return
        }
        await answerTelegramCallback(
          callback.id,
          "Opening Premium",
        )

        await TelegramPaymentSession.findOneAndUpdate(
          {
            chatId: String(chatId),
            telegramUserId: String(telegramUserId),
          },
          {
            $set: {
              language: "en",
              userId: null,
              email: "",
              studentName: "",
              paymentMethod: null,
              step: "awaiting_language",
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        )

        await sendTelegramMessage(
          chatId,
          "Choose your language to continue with Premium payment.",
          languageKeyboard,
        )
      } else if (action === "menu_main") {
        await answerTelegramCallback(callback.id, "Main menu")
        await sendMainMenu(chatId)
      } else if (action === "menu_feedback") {
        await answerTelegramCallback(callback.id, "Choose a support option")
        await sendTelegramMessage(
          chatId,
          "📝 Feedback & Complaints\n\nChoose a category, then send your message. You can send /cancel at any time.",
          feedbackMenuKeyboard,
        )
      } else if (action === "menu_help") {
        await answerTelegramCallback(callback.id, "Help and FAQ")
        await sendTelegramMessage(
          chatId,
          `📚 Steady Mate Bot Help

/start — Open the main menu
/premium — Start a Premium payment
/complaint — Report a problem
/feedback — Share feedback
/suggestion — Suggest a feature
/referral — Check referral earnings
/withdraw — Open the referral withdrawal page
/cancel — Cancel the current action

Premium payments are reviewed by an admin before activation.

Never send your password to anyone.`,
          helpMenuKeyboard,
        )
      } else if (action === "menu_support") {
        await answerTelegramCallback(
          callback.id,
          "Support options",
        )

        await sendTelegramMessage(
          chatId,
          "🆘 Steady Mate Support\n\nChoose Complaint to report a problem, Feedback to share your experience, or Suggest a Feature to share an idea.",
          {
            inline_keyboard: [
              [{
                text: "📝 Complaint",
                callback_data: "support_complaint",
              }],
              [{
                text: "💡 Feedback",
                callback_data: "support_feedback",
              }],
              [{
                text: "✨ Suggest a Feature",
                callback_data: "support_suggestion",
              }],
              [{
                text: "⬅️ Back to Main Menu",
                callback_data: "menu_main",
              }],
            ],
          },
        )
      } else if (action === "menu_referrals") {
        await answerTelegramCallback(
          callback.id,
          "Opening referrals",
        )
        await sendReferralInformation(chatId, telegramUserId)
      }

      res.status(200).json({ success: true })
      return
    }

    // Complaint, feedback, and suggestion buttons.
    if (
      callback?.id &&
      callback.data?.startsWith("support_")
    ) {
      const action = callback.data

      const type: SupportType | null =
      action === "support_bug_report"
        ? "bug_report"
        : action === "support_complaint"
          ? "complaint"
          : action === "support_feedback"
            ? "feedback"
            : action === "support_payment_problem"
              ? "payment_problem"
              : action === "support_suggestion"
                ? "suggestion"
                : null

      if (type) {
        await answerTelegramCallback(
          callback.id,
          "Support request started",
        )

        await startSupportRequest(
          chatId,
          telegramUserId,
          type,
          callback.from?.username,
        )
      } else {
        await answerTelegramCallback(
          callback.id,
          "Unknown support option",
        )
      }

      res.status(200).json({ success: true })
      return
    }

    // Language selection for Premium payments.
    if (
      callback?.id &&
      callback.data?.startsWith("premium_lang_")
    ) {
      const language: BotLanguage =
        callback.data === "premium_lang_am"
          ? "am"
          : "en"

      const session =
        await TelegramPaymentSession.findOneAndUpdate(
          {
            chatId: String(chatId),
            telegramUserId: String(telegramUserId),
          },
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
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        )

      await answerTelegramCallback(
        callback.id,
        language === "am"
          ? "ቋንቋ ተመርጧል"
          : "Language selected",
      )

      await sendPremiumMethodPrompt(
        chatId,
        session.language || language,
      )

      res.status(200).json({ success: true })
      return
    }

    // Bank or Telebirr selection.
    if (
      callback?.id &&
      callback.data?.startsWith("premium_method_")
    ) {
      const method =
        callback.data === "premium_method_bank"
          ? "bank"
          : "telebirr"

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
        session.language === "am"
          ? "የክፍያ ዘዴ ተመርጧል"
          : "Payment method selected",
      )

      await sendPaymentInstructions(
        chatId,
        session.language || "en",
        method,
      )

      res.status(200).json({ success: true })
      return
    }

    // Existing referral withdrawal callback.
    if (
      callback?.data === "referral_withdraw_min" &&
      callback.id
    ) {
      const linkedUser = await User.findOne({
        telegramUserId: String(telegramUserId),
        telegramVerified: true,
      }).select("_id")

      if (!linkedUser) {
        await answerTelegramCallback(
          callback.id,
          "Link your verified Telegram account from your Steady Mate profile first.",
        )
      } else {
        await answerTelegramCallback(
          callback.id,
          "Choose your payout method on the referral page.",
        )

        await sendTelegramMessage(
          chatId,
          `Open your referral page to request a withdrawal:\n${getFrontendOrigin()}/referrals`,
        )
      }

      res.status(200).json({ success: true })
      return
    }

    // Main /start command.
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
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )

      await sendMainMenu(
        chatId,
      )

      res.status(200).json({ success: true })
      return
    }

    // Cancel the unfinished support or payment conversation.
    if (/^\/cancel(?:@\w+)?$/i.test(text)) {
      await TelegramSupportTicket.deleteMany({
        telegramUserId: String(telegramUserId),
        chatId: String(chatId),
        message: SUPPORT_PENDING_PREFIX,
      })

      const currentSession =
        await TelegramPaymentSession.findOne({
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
          ? "የአሁኑ ጥያቄዎ ተሰርዟል። እንደገና ለመጀመር /start ይላኩ።"
          : "Your current request was cancelled. Send /start to open the main menu.",
        mainMenuKeyboard,
      )

      res.status(200).json({ success: true })
      return
    }

    // Help.
    if (/^\/help(?:@\w+)?$/i.test(text)) {
      await sendTelegramMessage(
        chatId,
        `📚 Steady Mate Bot Help

/start — Open the main menu
/premium — Start a Premium payment
/complaint — Report a problem
/feedback — Share feedback
/suggestion — Suggest a feature
/referral — Check referral earnings
/cancel — Cancel the current action

Premium payments are reviewed by an admin before activation.

Never send your password to anyone.`,
        mainMenuKeyboard,
      )

      res.status(200).json({ success: true })
      return
    }

    // Direct support commands.
    const supportCommand = text.match(
      /^\/(complaint|feedback|suggestion)(?:@\w+)?$/i,
    )

    if (supportCommand) {
      const command = supportCommand[1].toLowerCase()

      const type: SupportType =
        command === "complaint"
          ? "complaint"
          : command === "feedback"
            ? "feedback"
            : "suggestion"

      await startSupportRequest(
        chatId,
        telegramUserId,
        type,
        update.message?.from?.username,
      )

      res.status(200).json({ success: true })
      return
    }

    // Premium command.
    if (/^\/premium(?:@\w+)?$/i.test(text)) {
      if (!(await reportPremiumPaymentConfiguration())) {
        await sendTelegramMessage(
          chatId,
          "Premium payment instructions are temporarily unavailable. Please try again later.",
        )
        res.status(200).json({ success: true })
        return
      }
      await TelegramPaymentSession.findOneAndUpdate(
        {
          chatId: String(chatId),
          telegramUserId: String(telegramUserId),
        },
        {
          $set: {
            language: "en",
            userId: null,
            email: "",
            studentName: "",
            paymentMethod: null,
            step: "awaiting_language",
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )

      await sendTelegramMessage(
        chatId,
        "Choose your language to continue with Premium payment.",
        languageKeyboard,
      )

      res.status(200).json({ success: true })
      return
    }

    // Referral commands.
    const referralCommand =
      /^\/referral(?:@\w+)?$/i.test(text)

    const withdrawalCommand = text.match(
      /^\/withdraw(?:@\w+)?(?:\s+(\d+(?:\.\d{1,2})?))?$/i,
    )

    if (referralCommand || withdrawalCommand) {
        if (withdrawalCommand) {
          await sendTelegramMessage(
            chatId,
          `Submit withdrawals from your referral page, where you can choose Bank Transfer or Telebirr:\n${getFrontendOrigin()}/referrals`,
        )

        res.status(200).json({ success: true })
        return
      }

      await sendReferralInformation(chatId, telegramUserId)

      res.status(200).json({ success: true })
      return
    }

    // Accept the next message for a pending support ticket.
    const pendingTicket =
      await TelegramSupportTicket.findOne({
        telegramUserId: String(telegramUserId),
        chatId: String(chatId),
        message: SUPPORT_PENDING_PREFIX,
        status: "open",
      }).sort({ createdAt: -1 })

    if (pendingTicket) {
      if (!text || text.startsWith("/")) {
        await sendTelegramMessage(
          chatId,
          "Please send your support message as text, or send /cancel to cancel.",
        )

        res.status(200).json({ success: true })
        return
      }

      const message = text.trim()

      if (!message || message.length > 3000) {
        await sendTelegramMessage(
          chatId,
          "Please send a message between 1 and 3,000 characters.",
        )

        res.status(200).json({ success: true })
        return
      }

      pendingTicket.message = message
      await pendingTicket.save()

      const rawPendingType: unknown = pendingTicket.type
      const pendingType = isSupportType(rawPendingType)
        ? rawPendingType
        : null

      try {
        await notifySupportAdmin(
          pendingTicket._id.toString(),
          pendingType || "feedback",
          telegramUserId,
          update.message?.from?.username,
          message,
        )
      } catch (error) {
        console.error(
          "Support admin notification failed:",
          error instanceof Error
            ? error.message
            : "Unknown error",
        )
      }

      await sendTelegramMessage(
        chatId,
        `✅ Your ${pendingType ? supportTypeLabels[pendingType] : "Support request"} has been recorded.

Ticket ID: ${pendingTicket._id}

Thank you for helping us improve Steady Mate.`,
        mainMenuKeyboard,
      )

      res.status(200).json({ success: true })
      return
    }

    const messagePhoto = update.message?.photo
    const document = update.message?.document

    const screenshotFileId =
      messagePhoto?.[messagePhoto.length - 1]?.file_id ||
      (
        document?.mime_type?.startsWith("image/")
          ? document.file_id
          : undefined
      )

    const session = await TelegramPaymentSession.findOne({
      chatId: String(chatId),
      telegramUserId: String(telegramUserId),
    })

    if (!session) {
      await sendTelegramMessage(
        chatId,
        "Open the main menu with /start to get started.",
        mainMenuKeyboard,
      )

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

      const user = await User.findOne({ email })
        .select("_id email name")

      if (!user) {
        await sendTelegramMessage(
          chatId,
          session.language === "am"
            ? "ይህን ኢሜይል የያዘ የSteady Mate መለያ አልተገኘም።"
            : "We couldn't find a Steady Mate account with this email. Please use your account email.",
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

      if (
        studentName.length < 2 ||
        studentName.length > 120
      ) {
        await sendTelegramMessage(
          chatId,
          "Please enter a valid full name.",
        )

        res.status(200).json({ success: true })
        return
      }

      session.studentName = studentName
      session.step = "awaiting_screenshot"
      await session.save()

      await sendTelegramMessage(
        chatId,
        `Please send a screenshot of your ${PREMIUM_PAYMENT_CONFIG.price} ETB payment receipt.`,
      )

      res.status(200).json({ success: true })
      return
    }

    if (
      session.step === "awaiting_screenshot" &&
      screenshotFileId &&
      session.userId &&
      session.email
    ) {
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
          "You already have a Premium payment waiting for admin review. We will notify you after it has been reviewed.",
        )

        res.status(200).json({ success: true })
        return
      }

      let storedScreenshot: {
        secureUrl: string
        publicId: string
      }

      try {
        const telegramImage =
          await getTelegramFile(screenshotFileId)

        const declaredLength = Number(
          telegramImage.headers.get("content-length"),
        )

        if (
          Number.isFinite(declaredLength) &&
          declaredLength > 10 * 1024 * 1024
        ) {
          throw new Error(
            "Payment screenshot exceeds the 10 MB limit",
          )
        }

        const image = Buffer.from(
          await telegramImage.arrayBuffer(),
        )

        if (image.length > 10 * 1024 * 1024) {
          throw new Error(
            "Payment screenshot exceeds the 10 MB limit",
          )
        }

        storedScreenshot =
          await uploadPaymentScreenshot(image)
      } catch (error) {
        logPaymentScreenshotError(
          "storage_failed",
          error,
          screenshotFileId,
        )

        await sendTelegramMessage(
          chatId,
          "We couldn't securely store your screenshot. Please send it again.",
        )

        res.status(200).json({ success: true })
        return
      }

      let createdPaymentId = ""
      try {
        const payment = await Payment.create({
          userId: session.userId,
          studentName: session.studentName,
          email: session.email,
          telegramUserId: String(telegramUserId),
          telegramChatId: String(chatId),
          telegramFileId: screenshotFileId,
          screenshotUrl: storedScreenshot.secureUrl,
          screenshotPublicId: storedScreenshot.publicId,
          telegramUpdateId: update.update_id,
          paymentMethod: session.paymentMethod,
          amount: PREMIUM_PAYMENT_CONFIG.price,
          currency: "ETB",
          type: "premium",
          status: "pending",
          submittedAt: new Date(),
        })
        createdPaymentId = payment._id.toString()
      } catch (error) {
        try {
          await deletePaymentScreenshot(
            storedScreenshot.publicId,
          )
        } catch (cleanupError) {
          logPaymentScreenshotError(
            "unused_upload_cleanup_failed",
            cleanupError,
            screenshotFileId,
          )
        }

        if (
          !(
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === 11000
          )
        ) {
          throw error
        }
      }

      session.step = "complete"
      await session.save()

      if (createdPaymentId) {
        await notifyPendingPaymentAdmin(
          createdPaymentId,
          session.studentName || "Not provided",
          session.email,
          session.paymentMethod,
        )
      }

      await sendTelegramMessage(
        chatId,
        `✅ Payment submitted

Your Premium payment has been submitted for verification.

Amount: ${PREMIUM_PAYMENT_CONFIG.price} ETB
Method: ${session.paymentMethod === "bank" ? "Bank Transfer" : "Telebirr"}
Status: Pending

Our admin will review your payment.`,
        mainMenuKeyboard,
      )

      res.status(200).json({ success: true })
      return
    }

    if (session.step === "complete") {
      await sendTelegramMessage(
        chatId,
        "Your payment submission is recorded. Send /start to open the main menu.",
        mainMenuKeyboard,
      )
    } else if (session.step === "awaiting_screenshot") {
      await sendTelegramMessage(
        chatId,
        "Please send your payment screenshot as an image.",
      )
    }

    res.status(200).json({ success: true })
  } catch (error) {
    console.error(
      "Telegram update processing failed:",
      error instanceof Error ? error.message : "Unknown error",
    )

    res.status(500).json({
      success: false,
      message: "Unable to process Telegram update",
    })
  }
}

export const configureTelegramWebhook =
  async (): Promise<void> => {
    await registerTelegramWebhook()
  }
