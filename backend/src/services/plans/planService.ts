import mongoose from "mongoose"

import { Material } from "../../models/Material"
import { UsageCounter, UsageFeature } from "../../models/UsageCounter"
import { User } from "../../models/User"
import { PREMIUM_MONTHLY_PRICE } from "../../config/pricing"

const MB = 1024 * 1024
const GB = 1024 * MB

export const PLAN_LIMITS = {
  free: {
    materials: 10,
    notes: 10,
    flashcards: 10,
    quizzes: 10,
    aiTutor: 3,
    storage: 100 * MB,
  },
  premium: {
    materials: 100,
    notes: 100,
    flashcards: 100,
    quizzes: 100,
    aiTutor: 1000,
    storage: 2 * GB,
  },
} as const

export type PlanName = keyof typeof PLAN_LIMITS
export type UsagePeriod = "total" | "month" | "day"
type UsageFeatureLimit = UsageFeature

type UsageValue = {
  used: number
  limit: number
  remaining: number
  period: UsagePeriod
}

export type PlanUsageSummary = {
  plan: PlanName
  premiumPrice: {
    amount: typeof PREMIUM_MONTHLY_PRICE
    currency: "ETB"
    period: "month"
  }
  periodKeys: {
    day: string
    month: string
    timezone: "UTC"
  }
  usage: {
    materials: UsageValue
    notes: UsageValue
    flashcards: UsageValue
    quizzes: UsageValue
    aiTutor: UsageValue
    storage: Omit<UsageValue, "period"> & { period: "total"; unit: "bytes" }
    progress: { included: true }
  }
}

type ConsumeResult =
  | { allowed: true; used: number; limit: number; period: UsagePeriod }
  | {
      allowed: false
      used: number
      limit: number
      period: UsagePeriod
      plan: PlanName
    }

export type MaterialLimitResult =
  | { allowed: true }
  | {
      allowed: false
      feature: "materials" | "storage"
      period: "total"
      used: number
      limit: number
      plan: PlanName
    }

const utcDayKey = (date: Date) => date.toISOString().slice(0, 10)
const utcMonthKey = (date: Date) => date.toISOString().slice(0, 7)
const createPeriodKey = (period: UsagePeriod, date: Date) =>
  period === "day" ? utcDayKey(date) : utcMonthKey(date)

export const getActivePlan = (
  user: { isPremium?: boolean; premiumExpiresAt?: Date | null },
  now = new Date(),
): PlanName =>
  user.isPremium === true &&
  user.premiumExpiresAt instanceof Date &&
  user.premiumExpiresAt > now
    ? "premium"
    : "free"

const usagePeriodFor = (
  feature: UsageFeatureLimit,
  plan: PlanName,
): UsagePeriod =>
  feature === "aiTutor" && plan === "free" ? "day" : "month"

const isDuplicateKeyError = (error: unknown): boolean =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: unknown }).code === 11000

export const consumeFeatureUsage = async (
  rawUserId: string,
  feature: UsageFeatureLimit,
  now = new Date(),
): Promise<ConsumeResult> => {
  if (!mongoose.Types.ObjectId.isValid(rawUserId)) {
    throw new Error("Invalid authenticated user")
  }

  const userId = new mongoose.Types.ObjectId(rawUserId)
  const user = await User.findById(userId).select(
    "isPremium premiumExpiresAt",
  )
  if (!user) throw new Error("Student account not found")

  const plan = getActivePlan(user, now)
  const period = usagePeriodFor(feature, plan)
  const periodKey = createPeriodKey(period, now)
  const limit = PLAN_LIMITS[plan][feature]
  const filter = { userId, feature, periodKey, used: { $lt: limit } }

  const updated = await UsageCounter.findOneAndUpdate(
    filter,
    { $inc: { used: 1 } },
    { new: true },
  )

  if (updated) {
    return { allowed: true, used: updated.used, limit, period }
  }

  try {
    const created = await UsageCounter.create({
      userId,
      feature,
      periodKey,
      used: 1,
    })
    return { allowed: true, used: created.used, limit, period }
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
  }

  const retried = await UsageCounter.findOneAndUpdate(
    filter,
    { $inc: { used: 1 } },
    { new: true },
  )
  if (retried) {
    return { allowed: true, used: retried.used, limit, period }
  }

  const exhausted = await UsageCounter.findOne({
    userId,
    feature,
    periodKey,
  }).select("used")

  return {
    allowed: false,
    used: exhausted?.used || limit,
    limit,
    period,
    plan,
  }
}

export const checkMaterialAllowance = async (
  rawUserId: string,
  incomingBytes = 0,
): Promise<MaterialLimitResult> => {
  if (!mongoose.Types.ObjectId.isValid(rawUserId)) {
    throw new Error("Invalid authenticated user")
  }
  const userId = new mongoose.Types.ObjectId(rawUserId)
  const user = await User.findById(userId).select(
    "isPremium premiumExpiresAt",
  )
  if (!user) throw new Error("Student account not found")

  const plan = getActivePlan(user)
  const limits = PLAN_LIMITS[plan]
  const [materialCount, storageResults] = await Promise.all([
    Material.countDocuments({ userId }),
    Material.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$size" } } },
    ]),
  ])
  if (materialCount >= limits.materials) {
    return {
      allowed: false,
      feature: "materials",
      period: "total",
      used: materialCount,
      limit: limits.materials,
      plan,
    }
  }

  const storageUsed = storageResults[0]?.total || 0
  if (storageUsed + incomingBytes > limits.storage) {
    return {
      allowed: false,
      feature: "storage",
      period: "total",
      used: storageUsed,
      limit: limits.storage,
      plan,
    }
  }
  return { allowed: true }
}

const initializeMaterialUsage = async (
  userId: mongoose.Types.ObjectId,
): Promise<void> => {
  const user = await User.findById(userId).select(
    "+materialCount +materialStorageUsed",
  )
  if (!user) throw new Error("Student account not found")
  if (
    user.materialCount !== undefined &&
    user.materialStorageUsed !== undefined
  ) {
    return
  }

  const [materialCount, storageResults] = await Promise.all([
    Material.countDocuments({ userId }),
    Material.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$size" } } },
    ]),
  ])
  await User.updateOne(
    {
      _id: userId,
      $or: [
        { materialCount: { $exists: false } },
        { materialStorageUsed: { $exists: false } },
      ],
    },
    {
      $set: {
        materialCount,
        materialStorageUsed: storageResults[0]?.total || 0,
      },
    },
  )
}

export const reserveMaterialCapacity = async (
  rawUserId: string,
  incomingBytes: number,
): Promise<MaterialLimitResult> => {
  if (
    !mongoose.Types.ObjectId.isValid(rawUserId) ||
    !Number.isSafeInteger(incomingBytes) ||
    incomingBytes < 0
  ) {
    throw new Error("Invalid material capacity request")
  }
  const userId = new mongoose.Types.ObjectId(rawUserId)
  const user = await User.findById(userId).select(
    "isPremium premiumExpiresAt",
  )
  if (!user) throw new Error("Student account not found")
  const plan = getActivePlan(user)
  const limits = PLAN_LIMITS[plan]
  await initializeMaterialUsage(userId)

  const reserved = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $and: [
          { $lt: ["$materialCount", limits.materials] },
          {
            $lte: [
              { $add: ["$materialStorageUsed", incomingBytes] },
              limits.storage,
            ],
          },
        ],
      },
    },
    {
      $inc: {
        materialCount: 1,
        materialStorageUsed: incomingBytes,
      },
    },
    { new: true },
  ).select("+materialCount +materialStorageUsed")

  if (reserved) return { allowed: true }

  const current = await User.findById(userId).select(
    "+materialCount +materialStorageUsed",
  )
  if (!current) throw new Error("Student account not found")
  if ((current.materialCount || 0) >= limits.materials) {
    return {
      allowed: false,
      feature: "materials",
      period: "total",
      used: current.materialCount || 0,
      limit: limits.materials,
      plan,
    }
  }
  return {
    allowed: false,
    feature: "storage",
    period: "total",
    used: current.materialStorageUsed || 0,
    limit: limits.storage,
    plan,
  }
}

export const releaseMaterialCapacity = async (
  rawUserId: string,
  materialBytes: number,
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(rawUserId)) {
    throw new Error("Invalid authenticated user")
  }
  const result = await User.updateOne(
    {
      _id: rawUserId,
      materialCount: { $gt: 0 },
      materialStorageUsed: { $gte: materialBytes },
    },
    {
      $inc: {
        materialCount: -1,
        materialStorageUsed: -materialBytes,
      },
    },
  )
  if (result.modifiedCount !== 1) {
    throw new Error("Unable to release reserved material capacity")
  }
}

export const getPlanUsageSummary = async (
  rawUserId: string,
  now = new Date(),
): Promise<PlanUsageSummary> => {
  if (!mongoose.Types.ObjectId.isValid(rawUserId)) {
    throw new Error("Invalid authenticated user")
  }
  const userId = new mongoose.Types.ObjectId(rawUserId)
  const user = await User.findById(userId).select(
    "isPremium premiumExpiresAt",
  )
  if (!user) throw new Error("Student account not found")

  const plan = getActivePlan(user, now)
  const monthKey = utcMonthKey(now)
  const dayKey = utcDayKey(now)
  const [records, materialCount, storageResults] = await Promise.all([
    UsageCounter.find({
      userId,
      $or: [
        { periodKey: monthKey },
        { periodKey: dayKey },
      ],
    })
      .select("feature periodKey used")
      .lean(),
    Material.countDocuments({ userId }),
    Material.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$size" } } },
    ]),
  ])

  const usedFor = (feature: UsageFeature, periodKey: string) =>
    records.find(
      (record) =>
        record.feature === feature && record.periodKey === periodKey,
    )?.used || 0
  const limits = PLAN_LIMITS[plan]
  const value = (
    used: number,
    limit: number,
    period: UsagePeriod,
  ): UsageValue => ({
    used,
    limit,
    remaining: Math.max(0, limit - used),
    period,
  })
  const aiTutorPeriod: UsagePeriod = plan === "free" ? "day" : "month"
  const aiTutorKey = plan === "free" ? dayKey : monthKey
  const storageUsed = storageResults[0]?.total || 0

  return {
    plan,
    premiumPrice: { amount: PREMIUM_MONTHLY_PRICE, currency: "ETB", period: "month" },
    periodKeys: { day: dayKey, month: monthKey, timezone: "UTC" },
    usage: {
      materials: value(materialCount, limits.materials, "total"),
      notes: value(usedFor("notes", monthKey), limits.notes, "month"),
      flashcards: value(
        usedFor("flashcards", monthKey),
        limits.flashcards,
        "month",
      ),
      quizzes: value(usedFor("quizzes", monthKey), limits.quizzes, "month"),
      aiTutor: value(
        usedFor("aiTutor", aiTutorKey),
        limits.aiTutor,
        aiTutorPeriod,
      ),
      storage: {
        used: storageUsed,
        limit: limits.storage,
        remaining: Math.max(0, limits.storage - storageUsed),
        period: "total",
        unit: "bytes",
      },
      progress: { included: true },
    },
  }
}
