import mongoose, { Document, Schema, Types } from "mongoose"

export type PaymentStatus = "pending" | "approved" | "rejected"

export interface IPayment extends Document {
  userId: Types.ObjectId
  studentName?: string
  email: string
  paymentMethod?: "bank" | "telebirr"
  telegramUserId?: string
  telegramChatId?: string
  amount: number
  currency: string
  type: "premium"
  status: PaymentStatus
  telegramReference?: string
  screenshot?: string
  screenshotUrl?: string
  screenshotPublicId?: string
  telegramFileId?: string
  telegramUpdateId?: number
  rejectionReason?: string
  submittedAt: Date
  reviewedAt?: Date
  reviewedBy?: Types.ObjectId
  notes?: string
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["bank", "telebirr"],
      default: undefined,
    },
    telegramUserId: {
      type: String,
      default: "",
    },
    telegramChatId: {
      type: String,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "ETB",
    },
    type: {
      type: String,
      enum: ["premium"],
      default: "premium",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    telegramReference: {
      type: String,
      default: "",
    },
    screenshot: {
      type: String,
      default: "",
    },
    screenshotUrl: {
      type: String,
      default: "",
    },
    screenshotPublicId: {
      type: String,
      default: "",
    },
    telegramFileId: {
      type: String,
      default: "",
    },
    telegramUpdateId: {
      type: Number,
      unique: true,
      sparse: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: {
      type: String,
      default: "",
    },
    rejectionReason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
)

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema)
