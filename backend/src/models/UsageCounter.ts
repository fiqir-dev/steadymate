import mongoose, { Document, Schema } from "mongoose"

export type UsageFeature = "notes" | "flashcards" | "quizzes" | "aiTutor"

export interface IUsageCounter extends Document {
  userId: mongoose.Types.ObjectId
  feature: UsageFeature
  periodKey: string
  used: number
  createdAt: Date
  updatedAt: Date
}

const usageCounterSchema = new Schema<IUsageCounter>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    feature: {
      type: String,
      enum: ["notes", "flashcards", "quizzes", "aiTutor"],
      required: true,
    },
    periodKey: {
      type: String,
      required: true,
    },
    used: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
)

usageCounterSchema.index(
  { userId: 1, feature: 1, periodKey: 1 },
  { unique: true },
)

export const UsageCounter = mongoose.model<IUsageCounter>(
  "UsageCounter",
  usageCounterSchema,
)
