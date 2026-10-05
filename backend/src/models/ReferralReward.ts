import mongoose, { Document, Schema, Types } from "mongoose"
import { REFERRAL_REWARD_PERCENTAGE } from "../config/pricing"

export type ReferralRewardStatus = "pending" | "approved" | "paid"

export interface IReferralReward extends Document {
  referrerId: Types.ObjectId
  referredUserId: Types.ObjectId
  paymentId: Types.ObjectId
  amount: number
  percentage: number
  status: ReferralRewardStatus
  createdAt: Date
  paidAt?: Date
  approvedAt?: Date
}

const referralRewardSchema = new Schema<IReferralReward>(
  {
    referrerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referredUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Number,
      required: true,
      default: REFERRAL_REWARD_PERCENTAGE,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "paid"],
      default: "pending",
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

export const ReferralReward = mongoose.model<IReferralReward>(
  "ReferralReward",
  referralRewardSchema
)
