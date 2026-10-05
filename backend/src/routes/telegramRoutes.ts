import express from "express"

import {
  createTelegramVerification,
  getTelegramVerificationStatus,
  handleTelegramWebhook,
} from "../controllers/telegramVerificationController"
import { requireAuth } from "../middleware/authMiddleware"

const router = express.Router()

router.get("/status", requireAuth, getTelegramVerificationStatus)
router.post("/verification", requireAuth, createTelegramVerification)
router.post("/webhook", handleTelegramWebhook)

export default router
