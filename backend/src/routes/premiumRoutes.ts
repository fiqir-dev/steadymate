import express from "express"

import { getPremiumStatus } from "../controllers/authController"
import {
  getPremiumPricing,
  getMyPremiumPayments,
  submitPremiumPayment,
} from "../controllers/premiumController"
import { requireAuth } from "../middleware/authMiddleware"

const router = express.Router()

router.get("/pricing", getPremiumPricing)
router.get("/status", requireAuth, getPremiumStatus)
router.get("/payments/my", requireAuth, getMyPremiumPayments)
router.post("/payment", requireAuth, submitPremiumPayment)

export default router
