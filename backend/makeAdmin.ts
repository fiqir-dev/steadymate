import mongoose from "mongoose"
import dotenv from "dotenv"
import { User } from "./src/models/User"

dotenv.config()

async function makeAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    if (!email) {
      throw new Error("Set ADMIN_EMAIL to the account email that should receive the admin role.")
    }
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not configured.")
    }
    await mongoose.connect(mongoUri)

    const user = await User.findOneAndUpdate(
      { email },
      { $set: { role: "admin" } },
      { new: true }
    )

    if (!user) {
      console.log("User not found.")
      return
    }

    console.log("Admin created successfully:")
    console.log({ role: user.role })
  } catch (error) {
    console.error("Failed:", error)
  } finally {
    await mongoose.disconnect()
  }
}

makeAdmin()