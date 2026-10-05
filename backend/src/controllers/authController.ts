import "dotenv/config"
import { Request, Response } from "express"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import { Resend } from "resend"

import { User, normalizeUserRole } from "../models/User"
import { Referral } from "../models/Referral"
import { hashPassword, comparePassword } from "../utils/password"
import { getPlanUsageSummary } from "../services/plans/planService"

const resend = new Resend(process.env.RESEND_API_KEY)

const generateReferralCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let result = ""

  for (let index = 0; index < 8; index += 1) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }

  return result
}

export const signup = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, password, ref } = req.body

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      })
      return
    }

    const normalizedEmail = email.toLowerCase().trim()

    const existingUser = await User.findOne({
      email: normalizedEmail,
    })

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      })
      return
    }

    let finalReferralCode = generateReferralCode()
    while (await User.exists({ referralCode: finalReferralCode })) {
      finalReferralCode = generateReferralCode()
    }

    const hashedPassword = await hashPassword(password)

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      referralCode: finalReferralCode,
      isPremium: false,
      premiumExpiresAt: null,
      materialCount: 0,
      materialStorageUsed: 0,
      role: "user",
    })

    const referralCodeValue = typeof ref === "string" ? ref.trim().toUpperCase() : ""
    if (referralCodeValue) {
      const inviter = await User.findOne({ referralCode: referralCodeValue })

      if (inviter && inviter._id.toString() !== user._id.toString()) {
        user.referredBy = inviter._id
        await user.save()

        const referralExists = await Referral.findOne({ referredUserId: user._id })
        if (!referralExists) {
          await Referral.create({
            referrerId: inviter._id,
            referredUserId: user._id,
            referralCode: referralCodeValue,
          })
        }
      }
    }

    const safeRole = normalizeUserRole(user.role)
    if (user.role !== safeRole) {
      user.role = safeRole
      await user.save()
    }

    const jwtSecret = process.env.JWT_SECRET

    if (!jwtSecret) {
      res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      })
      return
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: safeRole,
      },
      jwtSecret,
      {
        expiresIn: "7d",
      },
    )

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        telegramVerified: user.telegramVerified === true,
        role: safeRole,
        referralCode: user.referralCode,
      },
    })
  } catch (error) {
    console.error("Signup error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to create account",
    })
  }
}

export const login = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      })
      return
    }

    const normalizedEmail = email.toLowerCase().trim()

    const user = await User.findOne({
      email: normalizedEmail,
    })

    if (!user || !user.password) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
      return
    }

    const passwordMatches = await comparePassword(
      password,
      user.password,
    )

    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
      return
    }

    const currentUser = await User.findById(user._id)

    if (!currentUser) {
      res.status(401).json({
        success: false,
        message: "Invalid user session",
      })
      return
    }

    const currentRole = normalizeUserRole(currentUser.role)
    if (currentUser.role !== currentRole) {
      currentUser.role = currentRole
      await currentUser.save()
    }

    const jwtSecret = process.env.JWT_SECRET

    if (!jwtSecret) {
      res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      })
      return
    }

    const token = jwt.sign(
      {
        userId: currentUser._id.toString(),
        role: currentRole,
      },
      jwtSecret,
      {
        expiresIn: "7d",
      },
    )

    const isPremiumActive =
      currentUser.isPremium === true &&
      currentUser.premiumExpiresAt instanceof Date &&
      currentUser.premiumExpiresAt > new Date()

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        grade: currentUser.grade,
        profilePicture: currentUser.profilePicture,
        isPremium: isPremiumActive,
        premiumExpiresAt: currentUser.premiumExpiresAt || null,
        telegramVerified: currentUser.telegramVerified === true,
        role: currentRole,
        referralCode: currentUser.referralCode,
      },
    })
  } catch (error) {
    console.error("Login error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to login",
    })
  }
}

export const adminLogin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      })
      return
    }

    const normalizedEmail = email.toLowerCase().trim()
    const user = await User.findOne({ email: normalizedEmail })

    if (!user || !user.password) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
      return
    }

    const passwordMatches = await comparePassword(password, user.password)

    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
      return
    }

    if (user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      })
      return
    }

    const jwtSecret = process.env.JWT_SECRET

    if (!jwtSecret) {
      res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      })
      return
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      jwtSecret,
      { expiresIn: "7d" },
    )

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Admin login error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to login",
    })
  }
}

export const getProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select(
      "name email grade profilePicture isPremium premiumExpiresAt telegramVerified role referralCode createdAt",
    )

    if (!user) {
      res.status(404).json({
        success: false,
        message: "Student account not found",
      })
      return
    }

    const safeRole = normalizeUserRole(user.role)
    if (user.role !== safeRole) {
      user.role = safeRole
      await user.save()
    }

    const isPremiumActive =
      user.isPremium === true &&
      user.premiumExpiresAt instanceof Date &&
      user.premiumExpiresAt > new Date()

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        grade: user.grade,
        profilePicture: user.profilePicture,
        isPremium: isPremiumActive,
        premiumExpiresAt: user.premiumExpiresAt || null,
        telegramVerified: user.telegramVerified === true,
        role: safeRole,
        referralCode: user.referralCode,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error("Get profile error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to load profile",
    })
  }
}

export const updateProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, grade, password } = req.body

    const updates: {
      name?: string
      grade?: string
      password?: string
    } = {}

    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        })
        return
      }

      updates.name = name.trim()
    }

    if (grade !== undefined) {
      updates.grade = grade.trim()
    }

    if (password !== undefined) {
      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        })
        return
      }

      updates.password = await hashPassword(password)
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      updates,
      {
        new: true,
        runValidators: true,
      },
    ).select(
      "name email grade profilePicture isPremium premiumExpiresAt telegramVerified role referralCode createdAt",
    )

    if (!user) {
      res.status(404).json({
        success: false,
        message: "Student account not found",
      })
      return
    }

    const isPremiumActive =
      user.isPremium === true &&
      user.premiumExpiresAt instanceof Date &&
      user.premiumExpiresAt > new Date()

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        grade: user.grade,
        profilePicture: user.profilePicture,
        isPremium: isPremiumActive,
        premiumExpiresAt: user.premiumExpiresAt || null,
        telegramVerified: user.telegramVerified === true,
        role: user.role,
        referralCode: user.referralCode,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error("Update profile error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to update profile",
    })
  }
}

/*
|--------------------------------------------------------------------------
| Forgot Password
|--------------------------------------------------------------------------
*/

export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Email is required",
      })
      return
    }

    const normalizedEmail = email.toLowerCase().trim()

    const user = await User.findOne({
      email: normalizedEmail,
    })

    /*
     * Don't reveal whether an email is registered.
     */
    if (!user) {
      res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a password reset email will be sent.",
      })
      return
    }

    /*
     * Generate a cryptographically secure reset token.
     */
    const resetToken = crypto.randomBytes(32).toString("hex")

    user.passwordResetToken = resetToken
    user.passwordResetExpiresAt = new Date(
      Date.now() + 15 * 60 * 1000,
    )

    await user.save()

    const frontendUrl =
      process.env.FRONTEND_URL || "http://localhost:5173"

    const resetUrl =
      `${frontendUrl}/reset-password?token=${resetToken}`

    const { error } = await resend.emails.send({
      from: "Steady Mate <onboarding@resend.dev>",
      to: [user.email],
      subject: "Reset your Steady Mate password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Reset your Steady Mate password</title>
          </head>

          <body
            style="
              margin: 0;
              padding: 0;
              background: #f4f7fb;
              font-family: Arial, Helvetica, sans-serif;
            "
          >
            <div
              style="
                max-width: 600px;
                margin: 40px auto;
                padding: 32px 20px;
              "
            >
              <div
                style="
                  background: #ffffff;
                  border-radius: 18px;
                  padding: 40px 32px;
                  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
                "
              >
                <h1
                  style="
                    margin: 0 0 8px;
                    color: #173f8a;
                    font-size: 28px;
                  "
                >
                  Steady Mate
                </h1>

                <h2
                  style="
                    margin: 28px 0 12px;
                    color: #172033;
                    font-size: 22px;
                  "
                >
                  Reset your password
                </h2>

                <p
                  style="
                    color: #5f6b7a;
                    font-size: 15px;
                    line-height: 1.7;
                  "
                >
                  Hi ${user.name},
                </p>

                <p
                  style="
                    color: #5f6b7a;
                    font-size: 15px;
                    line-height: 1.7;
                  "
                >
                  We received a request to reset your Steady Mate
                  password. Click the button below to create a new password.
                </p>

                <div style="text-align: center; margin: 32px 0;">
                  <a
                    href="${resetUrl}"
                    style="
                      display: inline-block;
                      padding: 14px 24px;
                      background: #173f8a;
                      color: #ffffff;
                      text-decoration: none;
                      border-radius: 10px;
                      font-weight: 600;
                      font-size: 15px;
                    "
                  >
                    Reset Password
                  </a>
                </div>

                <p
                  style="
                    color: #7a8492;
                    font-size: 13px;
                    line-height: 1.6;
                  "
                >
                  This link will expire in 15 minutes.
                  If you didn't request a password reset, you can safely
                  ignore this email.
                </p>

                <hr
                  style="
                    border: 0;
                    border-top: 1px solid #e8edf3;
                    margin: 28px 0;
                  "
                />

                <p
                  style="
                    color: #9aa3af;
                    font-size: 12px;
                    line-height: 1.5;
                  "
                >
                  Steady Mate — Your AI study companion.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error("Resend email error:", error)

      /*
       * Remove the reset token if email delivery failed.
       * This prevents a token from remaining active when the
       * student never received the email.
       */
      user.passwordResetToken = undefined
      user.passwordResetExpiresAt = undefined

      await user.save()

      res.status(500).json({
        success: false,
        message:
          "Unable to send password reset email. Please try again later.",
      })

      return
    }

    res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a password reset email will be sent.",
    })
  } catch (error) {
    console.error("Forgot password error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to process password reset request",
    })
  }
}

/*
|--------------------------------------------------------------------------
| Reset Password
|--------------------------------------------------------------------------
*/

export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      })
      return
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      })
      return
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpiresAt: {
        $gt: new Date(),
      },
    })

    if (!user) {
      res.status(400).json({
        success: false,
        message:
          "This password reset link is invalid or has expired",
      })
      return
    }

    user.password = await hashPassword(password)

    /*
     * Make the reset token unusable after successful reset.
     */
    user.passwordResetToken = undefined
    user.passwordResetExpiresAt = undefined

    await user.save()

    res.status(200).json({
      success: true,
      message:
        "Password reset successfully. You can now sign in.",
    })
  } catch (error) {
    console.error("Reset password error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to reset password",
    })
  }
}

/*
|--------------------------------------------------------------------------
| Premium Status
|--------------------------------------------------------------------------
*/

export const getPremiumStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select(
      "isPremium premiumExpiresAt",
    )

    if (!user) {
      res.status(404).json({
        success: false,
        message: "Student account not found",
      })
      return
    }

    const isPremium =
      user.isPremium === true &&
      user.premiumExpiresAt instanceof Date &&
      user.premiumExpiresAt > new Date()

    const usage = await getPlanUsageSummary(req.userId || "")

    res.status(200).json({
      success: true,

      premium: {
        isPremium,
        expiresAt: user.premiumExpiresAt || null,
      },
      plan: usage.plan,
      storage: usage.usage.storage,
    })
  } catch (error) {
    console.error("Get premium status error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to load Premium status",
    })
  }
}

export const getAccountUsage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }
    const usage = await getPlanUsageSummary(req.userId)
    res.status(200).json({ success: true, ...usage })
  } catch (error) {
    console.error("Get account usage error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load account usage",
    })
  }
}