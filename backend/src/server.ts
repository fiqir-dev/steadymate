import "dotenv/config"

import express = require("express")
import cors = require("cors")
import { connectDatabase } from "./config/database"
import authRoutes from "./routes/authRoutes"
import materialRoutes from "./routes/materialRoutes"
import aiTutorRoutes from "./routes/aiTutorRoutes"
import quizAttemptRoutes from "./routes/quizAttemptRoutes"
import studyContentRoutes from "./routes/studyContentRoutes"
import telegramRoutes from "./routes/telegramRoutes"
import premiumRoutes from "./routes/premiumRoutes"
import referralRoutes from "./routes/referralRoutes"
import adminRoutes from "./routes/adminRoutes"
import { configureTelegramWebhook } from "./controllers/telegramVerificationController"
import {
  ensureExistingUsersHaveReferralCodes,
  migrateReferralRewardValues,
} from "./services/referralCodeService"

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/materials", materialRoutes)
app.use("/api/ai-tutor", aiTutorRoutes)
app.use("/api/quiz-attempts", quizAttemptRoutes)
app.use("/api/study-content", studyContentRoutes)
app.use("/api/telegram", telegramRoutes)
app.use("/api/premium", premiumRoutes)
app.use("/api/referrals", referralRoutes)
app.use("/api/admin", adminRoutes)

// Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Steady Mate backend is running",
    database: "connected"
  })
})

// Root route
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Steady Mate API"
  })
})

// Start server
const startServer = async (): Promise<void> => {
  try {
    await connectDatabase()
    await ensureExistingUsersHaveReferralCodes()
    await migrateReferralRewardValues()
    await configureTelegramWebhook()

    app.listen(PORT, () => {
      console.log(
        `Steady Mate backend running on http://localhost:${PORT}`
      )
    })
  } catch (error) {
    console.error(
      "Failed to start Steady Mate backend:",
      error
    )

    process.exit(1)
  }
}

startServer()