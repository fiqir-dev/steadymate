import express from "express"
import multer from "multer"
import path from "path"
import fs from "fs"

import { requireAuth } from "../middleware/authMiddleware"
import { enforceMaterialCapacity } from "../middleware/planLimits"

import {
  createTextMaterial,
  getMaterial,
  listMaterials,
  uploadMaterial,
  deleteMaterial,
} from "../controllers/materialController"

const uploadDirectory = path.resolve(
  process.cwd(),
  "uploads",
)

fs.mkdirSync(uploadDirectory, {
  recursive: true,
})

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory)
  },

  filename: (_req, file, callback) => {
    const safeName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "-")

    callback(
      null,
      `${Date.now()}-${safeName}`,
    )
  },
})

const upload = multer({
  storage,

  limits: {
    fileSize: 20 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true)
      return
    }

    callback(
      new Error(
        "Only PDF, Word, and text files are supported",
      ),
    )
  },
})

const router = express.Router()

router.get(
  "/",
  requireAuth,
  listMaterials,
)

router.get(
  "/:id",
  requireAuth,
  getMaterial,
)

router.post(
  "/",
  requireAuth,
  enforceMaterialCapacity,
  upload.single("file"),
  uploadMaterial,
)

router.post(
  "/text",
  requireAuth,
  enforceMaterialCapacity,
  createTextMaterial,
)

router.delete(
  "/:id",
  requireAuth,
  deleteMaterial,
)

export default router