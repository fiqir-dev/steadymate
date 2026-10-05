import express from "express"

import {
  signup,
  login,
  adminLogin,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  getPremiumStatus,
  getAccountUsage,
} from "../controllers/authController"

import { requireAuth } from "../middleware/authMiddleware"

const router = express.Router()

// Authentication
router.post("/signup", signup)
router.post("/login", login)
router.post("/admin-login", adminLogin)

// Password recovery
router.post("/forgot-password", forgotPassword)
router.post("/reset-password", resetPassword)

// Authenticated student
router.get("/me", requireAuth, getProfile)
router.put("/profile", requireAuth, updateProfile)

// Premium
router.get("/premium", requireAuth, getPremiumStatus)
router.get("/usage", requireAuth, getAccountUsage)

export default router