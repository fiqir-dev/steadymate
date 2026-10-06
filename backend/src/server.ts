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

const adminScreenshotSessionCors = cors({
  origin: (origin, callback) => {
    let configuredFrontendOrigin = ""
    if (process.env.FRONTEND_URL) {
      configuredFrontendOrigin = new URL(process.env.FRONTEND_URL).origin
    }
    const allowedOrigins = new Set([
      configuredFrontendOrigin,
      "http://localhost:5173",
    ])
    callback(null, origin && allowedOrigins.has(origin) ? origin : false)
  },
  credentials: true,
})

// Middleware
app.options(
  "/api/admin/payments/:id/screenshot/view-session",
  adminScreenshotSessionCors,
)
app.use(cors())
const isAdminScreenshotRequest = (req: express.Request): boolean =>
  req.method === "GET" &&
  /^\/api\/admin\/payments\/[^/]+\/screenshot\/?$/.test(req.path)

app.use((req, res, next) => {
  if (isAdminScreenshotRequest(req)) {
    const paymentId = req.path.split("/")[4]
    console.info("[admin-screenshot]", {
      event: "request_received",
      paymentId,
      contentType: req.headers["content-type"] || "",
      contentEncoding: req.headers["content-encoding"] || "identity",
      contentLength: req.headers["content-length"] || "",
    })
    res.once("finish", () => {
      console.info("[admin-screenshot]", {
        event: "request_finished",
        paymentId,
        status: res.statusCode,
      })
    })
  }
  next()
})
app.use(express.json())
app.use((error: { status?: number; statusCode?: number; type?: string }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (isAdminScreenshotRequest(req)) {
    console.error("[admin-screenshot]", {
      event: "pre_route_error",
      paymentId: req.path.split("/")[4],
      status: error.statusCode || error.status || 500,
      type: error.type || "request_parser_error",
    })
  }
  next(error)
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/materials", materialRoutes)
app.use("/api/ai-tutor", aiTutorRoutes)
app.use("/api/quiz-attempts", quizAttemptRoutes)
app.use("/api/study-content", studyContentRoutes)
app.use("/api/telegram", telegramRoutes)
app.use("/api/premium", premiumRoutes)
app.use("/api/referrals", referralRoutes)
app.use("/api/admin", adminScreenshotSessionCors, adminRoutes)

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