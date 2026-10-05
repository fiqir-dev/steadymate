import { NextFunction, Request, Response } from "express"

import {
  checkMaterialAllowance,
  consumeFeatureUsage,
  PlanName,
  UsagePeriod,
} from "../services/plans/planService"

type LimitedFeature = "notes" | "flashcards" | "quizzes" | "aiTutor"

const limitMessage = (
  feature: LimitedFeature | "materials" | "storage",
  plan: PlanName,
  period: UsagePeriod,
) => {
  if (feature === "aiTutor" && plan === "free") {
    return "You've reached today's Free AI Tutor limit. Your AI Tutor limit resets tomorrow. Upgrade to Premium for up to 1,000 AI Tutor messages per month."
  }
  if (feature === "aiTutor") {
    return "You've reached your Premium AI Tutor limit for this month."
  }
  if (feature === "materials") {
    return `You've reached your ${plan === "free" ? "Free" : "Premium"} material limit.`
  }
  if (feature === "storage") {
    return "Your study material storage limit has been reached."
  }
  const label = feature === "notes" ? "Short Notes" : feature[0].toUpperCase() + feature.slice(1)
  return `You've reached your ${plan === "free" ? "Free" : "Premium"} ${label} generation limit for this month.`
}

export const respondWithLimit = (
  res: Response,
  details: {
    feature: LimitedFeature | "materials" | "storage"
    period: UsagePeriod
    used: number
    limit: number
    plan: PlanName
  },
): void => {
  res.status(429).json({
    success: false,
    code: "LIMIT_REACHED",
    feature: details.feature,
    period: details.period,
    used: details.used,
    limit: details.limit,
    message: limitMessage(details.feature, details.plan, details.period),
  })
}

export const consumeRequestFeatureUsage = async (
  req: Request,
  res: Response,
  feature: LimitedFeature,
): Promise<boolean> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return false
    }
    const result = await consumeFeatureUsage(req.userId, feature)
    if (!result.allowed) {
      respondWithLimit(res, {
        feature,
        period: result.period,
        used: result.used,
        limit: result.limit,
        plan: result.plan,
      })
      return false
    }
    return true
  } catch (error) {
    console.error(`Usage limit check failed for ${feature}:`, error)
    res.status(500).json({
      success: false,
      message: "Unable to verify your account usage limits",
    })
    return false
  }
}

export const enforceMaterialCapacity = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }
    const result = await checkMaterialAllowance(req.userId)
    if (!result.allowed) {
      respondWithLimit(res, result)
      return
    }
    next()
  } catch (error) {
    console.error("Material capacity check failed:", error)
    res.status(500).json({
      success: false,
      message: "Unable to verify your account material limit",
    })
  }
}
