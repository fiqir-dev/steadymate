import mongoose, { Document, Schema } from "mongoose"

export type SupportTicketType =
  | "bug_report"
  | "complaint"
  | "feedback"
  | "suggestion"
  | "payment_problem"

export type SupportTicketStatus = "open" | "answered" | "closed"

export interface ITelegramSupportTicket extends Document {
  telegramUserId: string
  chatId: string
  username?: string
  type: SupportTicketType
  message: string
  status: SupportTicketStatus
  adminReply?: string
  repliedAt?: Date
}

const TelegramSupportTicketSchema =
  new Schema<ITelegramSupportTicket>(
    {
      telegramUserId: {
        type: String,
        required: true,
        index: true,
      },
      chatId: {
        type: String,
        required: true,
      },
      username: {
        type: String,
        trim: true,
      },
      type: {
        type: String,
        enum: [
          "bug_report",
          "complaint",
          "feedback",
          "suggestion",
          "payment_problem",
        ],
        required: true,
      },
      message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 3000,
      },
      status: {
        type: String,
        enum: ["open", "answered", "closed"],
        default: "open",
        index: true,
      },
      adminReply: {
        type: String,
        maxlength: 3000,
      },
      repliedAt: Date,
    },
    { timestamps: true },
  )

export const TelegramSupportTicket =
  mongoose.models.TelegramSupportTicket ||
  mongoose.model<ITelegramSupportTicket>(
    "TelegramSupportTicket",
    TelegramSupportTicketSchema,
  )
