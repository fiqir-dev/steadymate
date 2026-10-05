import express from "express"

import {
  getMyReferrals,
  getMyReferralWithdrawals,
  getReferralStats,
  requestReferralWithdrawal,
} from "../controllers/referralController"
import { requireAuth } from "../middleware/authMiddleware"

const router = express.Router()

router.get("/", requireAuth, getMyReferrals)
router.get("/me", requireAuth, getMyReferrals)
router.get("/stats", requireAuth, getReferralStats)
router.get("/withdrawals", requireAuth, getMyReferralWithdrawals)
router.post("/withdrawals", requireAuth, requestReferralWithdrawal)

export default router
