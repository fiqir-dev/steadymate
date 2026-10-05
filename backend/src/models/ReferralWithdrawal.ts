import mongoose, { Document, Schema, Types } from "mongoose"
import { REFERRAL_MIN_WITHDRAWAL_ETB } from "../config/pricing"

export type ReferralWithdrawalStatus = "pending" | "approved" | "paid" | "rejected"
export type ReferralWithdrawalMethod = "bank_transfer" | "telebirr"

export interface IReferralWithdrawal extends Document {
  userId: Types.ObjectId
  amount: number
  paymentMethod: ReferralWithdrawalMethod
  bankName?: string
  accountHolderName: string
  accountNumber?: string
  telebirrPhone?: string
  status: ReferralWithdrawalStatus
  reviewedBy?: Types.ObjectId
  reviewedAt?: Date
  paidAt?: Date
  paidBy?: Types.ObjectId
  rejectionReason?: string
  createdAt: Date
  updatedAt: Date
}

const referralWithdrawalSchema = new Schema<IReferralWithdrawal>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, min: REFERRAL_MIN_WITHDRAWAL_ETB, required: true },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "telebirr"],
      required: true,
    },
    bankName: { type: String, trim: true, maxlength: 120 },
    accountHolderName: { type: String, trim: true, required: true, maxlength: 120 },
    accountNumber: { type: String, trim: true, maxlength: 80 },
    telebirrPhone: { type: String, trim: true, maxlength: 40 },
    status: {
      type: String,
      enum: ["pending", "approved", "paid", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true },
)

export const ReferralWithdrawal = mongoose.model<IReferralWithdrawal>(
  "ReferralWithdrawal",
  referralWithdrawalSchema,
)
