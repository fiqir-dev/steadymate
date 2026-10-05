import mongoose, { Document, Schema, Types } from "mongoose"

export type UserRole = "user" | "admin"

export const normalizeUserRole = (role?: string | null): UserRole =>
  role === "admin" ? "admin" : "user"

export interface IUser extends Document {
  name: string
  email: string
  password?: string
  googleId?: string
  profilePicture?: string
  grade?: string
  role: UserRole
  referralCode?: string
  referredBy?: Types.ObjectId | null
  referralReservedBalance?: number
  referralWithdrawnBalance?: number
  referralBalanceVersion?: number

  // Premium
  isPremium: boolean
  premiumExpiresAt?: Date | null
  materialCount?: number
  materialStorageUsed?: number
  telegramVerified: boolean
  telegramUserId?: string
  telegramVerificationHash?: string
  telegramVerificationExpiresAt?: Date
  telegramVerificationRequestedAt?: Date

  // Password reset
  passwordResetToken?: string
  passwordResetExpiresAt?: Date

  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: false,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    profilePicture: {
      type: String,
      default: "",
    },

    grade: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },

    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    referralReservedBalance: {
      type: Number,
      min: 0,
      default: 0,
      select: false,
    },
    referralWithdrawnBalance: {
      type: Number,
      min: 0,
      default: 0,
      select: false,
    },
    referralBalanceVersion: {
      type: Number,
      default: 0,
      select: false,
    },

    // -----------------------------
    // PREMIUM
    // -----------------------------

    isPremium: {
      type: Boolean,
      default: false,
    },

    premiumExpiresAt: {
      type: Date,
      default: null,
    },
    materialCount: {
      type: Number,
      min: 0,
      select: false,
    },
    materialStorageUsed: {
      type: Number,
      min: 0,
      select: false,
    },
    telegramVerified: {
      type: Boolean,
      default: false,
    },
    telegramUserId: {
      type: String,
      select: false,
    },
    telegramVerificationHash: {
      type: String,
      select: false,
    },
    telegramVerificationExpiresAt: {
      type: Date,
      select: false,
    },
    telegramVerificationRequestedAt: {
      type: Date,
      select: false,
    },

    // -----------------------------
    // PASSWORD RESET
    // -----------------------------

    passwordResetToken: {
      type: String,
      default: undefined,
    },

    passwordResetExpiresAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
)

export const User = mongoose.model<IUser>(
  "User",
  userSchema
)
