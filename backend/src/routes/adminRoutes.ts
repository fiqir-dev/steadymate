import express from "express"

import {
  approvePayment,
  approveReferralReward,
  createAdminPaymentScreenshotViewSession,
  getAdminDashboard,
  getAdminPayments,
  getAdminPaymentScreenshot,
  getAdminReferrals,
  getAdminReferralSummary,
  getAdminWithdrawals,
  getAdminUsers,
  markReferralPaid,
  rejectPayment,
  reviewReferralWithdrawal,
} from "../controllers/adminController"
import {
  requireAdmin,
  requireAuth,
  requireScreenshotViewAuth,
} from "../middleware/authMiddleware"

const router = express.Router()

router.get(
  "/payments/:id/screenshot/view",
  requireScreenshotViewAuth,
  requireAdmin,
  getAdminPaymentScreenshot,
)

router.use(requireAuth)
router.use(requireAdmin)

router.get("/dashboard", getAdminDashboard)
router.get("/payments", getAdminPayments)
router.get("/payments/:id/screenshot", getAdminPaymentScreenshot)
router.post(
  "/payments/:id/screenshot/view-session",
  createAdminPaymentScreenshotViewSession,
)
router.post("/payments/:id/approve", approvePayment)
router.post("/payments/:id/reject", rejectPayment)
router.get("/referrals", getAdminReferrals)
router.get("/referrals/summary", getAdminReferralSummary)
router.get("/referrals/withdrawals", getAdminWithdrawals)
router.post("/referrals/:id/approve", approveReferralReward)
router.post("/referrals/:id/pay", markReferralPaid)
router.post("/referrals/withdrawals/:id/:action", reviewReferralWithdrawal)
router.get("/users", getAdminUsers)

export default router
