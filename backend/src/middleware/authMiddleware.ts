import { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"

declare global {
  namespace Express {
    interface Request {
      userId?: string
      userRole?: string
    }
  }
}

const normalizeRole = (role?: string): "user" | "admin" =>
  role === "admin" ? "admin" : "user"

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authorization = req.headers.authorization
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : ""
  const jwtSecret = process.env.JWT_SECRET

  if (!token || !jwtSecret) {
    res.status(401).json({ success: false, message: "Authentication required" })
    return
  }

  try {
    const payload = jwt.verify(token, jwtSecret)

    if (typeof payload !== "object" || !payload.userId) {
      res.status(401).json({ success: false, message: "Invalid authentication token" })
      return
    }

    req.userId = String(payload.userId)
    req.userRole = normalizeRole(typeof payload.role === "string" ? payload.role : undefined)
    next()
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired authentication token" })
  }
}

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userId) {
    res.status(401).json({ success: false, message: "Authentication required" })
    return
  }

  if (req.userRole !== "admin") {
    res.status(403).json({ success: false, message: "Admin access required" })
    return
  }

  next()
}
