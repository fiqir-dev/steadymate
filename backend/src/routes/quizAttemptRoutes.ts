import express from "express"

import { requireAuth } from "../middleware/authMiddleware"
import {
  getQuizAnalytics,
  getRecentActivity,
  saveQuizAttempt,
} from "../controllers/quizAttemptController"

const router = express.Router()

router.get(
  "/analytics",
  requireAuth,
  getQuizAnalytics,
)

router.get(
  "/activity",
  requireAuth,
  getRecentActivity,
)

router.post(
  "/",
  requireAuth,
  saveQuizAttempt,
)

export default router