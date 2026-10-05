import mongoose, { Document, Schema, Types } from "mongoose"

export type TelegramPaymentStep =
  | "awaiting_language"
  | "awaiting_payment_method"
  | "awaiting_email"
  | "awaiting_name"
  | "awaiting_screenshot"
  | "complete"
export type TelegramPaymentLanguage = "en" | "am"
export type TelegramPaymentMethod = "bank" | "telebirr"

export interface ITelegramPaymentSession extends Document {
  chatId: string
  telegramUserId: string
  userId?: Types.ObjectId
  email?: string
  studentName?: string
  language?: TelegramPaymentLanguage
  paymentMethod?: TelegramPaymentMethod
  step: TelegramPaymentStep
  updatedAt: Date
}

const telegramPaymentSessionSchema = new Schema<ITelegramPaymentSession>(
  {
    chatId: { type: String, required: true, unique: true },
    telegramUserId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, lowercase: true, trim: true, default: "" },
    studentName: { type: String, trim: true, default: "" },
    language: { type: String, enum: ["en", "am"], default: "en" },
    paymentMethod: { type: String, enum: ["bank", "telebirr"], default: null },
    step: {
      type: String,
      enum: [
        "awaiting_language",
        "awaiting_payment_method",
        "awaiting_email",
        "awaiting_name",
        "awaiting_screenshot",
        "complete",
      ],
      required: true,
    },
  },
  { timestamps: true },
)

telegramPaymentSessionSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 86400 },
)

export const TelegramPaymentSession = mongoose.model<ITelegramPaymentSession>(
  "TelegramPaymentSession",
  telegramPaymentSessionSchema,
)
