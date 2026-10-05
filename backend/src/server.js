import "dotenv/config"
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI

app.use(cors())
app.use(express.json())

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Steady Mate backend is running",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  })
})

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Steady Mate API",
  })
})

async function startServer() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from the .env file")
  }

  await mongoose.connect(MONGODB_URI)
  console.log("MongoDB connected")

  app.listen(PORT, () => {
    console.log(`Steady Mate backend running on http://localhost:${PORT}`)
  })
}

startServer().catch((error: unknown) => {
  console.error("Failed to start backend:", error)
  process.exit(1)
})