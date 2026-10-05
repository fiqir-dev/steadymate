import mongoose, { Document, Schema, Types } from "mongoose"

export interface IReferral extends Document {
  referrerId: Types.ObjectId
  referredUserId: Types.ObjectId
  referralCode: string
  createdAt: Date
}

const referralSchema = new Schema<IReferral>(
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
      unique: true,
      index: true,
    },
    referralCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

export const Referral = mongoose.model<IReferral>("Referral", referralSchema)
