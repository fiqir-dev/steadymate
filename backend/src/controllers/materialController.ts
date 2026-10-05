import { Request, Response } from "express"
import mongoose from "mongoose"
import fs from "fs"

import { Material } from "../models/Material"
import { extractPdfText } from "../services/file/pdfService"
import {
  releaseMaterialCapacity,
  reserveMaterialCapacity,
} from "../services/plans/planService"
import { respondWithLimit } from "../middleware/planLimits"

// =========================================================
// LIST MATERIALS
// =========================================================

export const listMaterials = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const materials = await Material.find(
      {
        userId: req.userId,
      },
      {
        title: 1,
        originalName: 1,
        fileName: 1,
        mimeType: 1,
        size: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    )
      .sort({ createdAt: -1 })
      .lean()

    res.status(200).json({
      success: true,
      materials,
    })
  } catch (error) {
    console.error("List materials error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to load study materials",
    })
  }

}

export const getMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const materialId = req.params.id
    if (
      typeof materialId !== "string" ||
      !mongoose.Types.ObjectId.isValid(materialId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid study material",
      })
      return
    }

    const material = await Material.findOne({
      _id: materialId,
      userId: req.userId,
    })
      .select("title originalName mimeType content createdAt")
      .lean()

    if (!material) {
      res.status(404).json({
        success: false,
        message: "Study material not found",
      })
      return
    }

    res.status(200).json({
      success: true,
      material,
    })
  } catch (error) {
    console.error("Get material error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load this study material",
    })
  }
}

// =========================================================
// UPLOAD FILE MATERIAL
// =========================================================

export const uploadMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Choose a file to upload",
      })

      return
    }
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    // ---------------------------------------------
    // Material title
    // ---------------------------------------------

    const title =
      typeof req.body.title === "string" &&
      req.body.title.trim()
        ? req.body.title.trim()
        : req.file.originalname.replace(
            /\.[^/.]+$/,
            "",
          )

    // ---------------------------------------------
    // Extract text
    // ---------------------------------------------

    let content = ""

    if (
      req.file.mimetype ===
      "application/pdf"
    ) {
      content = await extractPdfText(
        req.file.path,
      )
    } else if (
      req.file.mimetype ===
      "text/plain"
    ) {
      content = await fs.promises.readFile(
        req.file.path,
        "utf8",
      )
    }

    // ---------------------------------------------
    // Save material
    // ---------------------------------------------

    const capacity = await reserveMaterialCapacity(
      req.userId,
      req.file.size,
    )
    if (!capacity.allowed) {
      try {
        await fs.promises.unlink(req.file.path)
      } catch (cleanupError) {
        console.error("Failed to remove rejected material upload:", cleanupError)
      }
      respondWithLimit(res, capacity)
      return
    }

    let material
    try {
      material = await Material.create({
        userId: req.userId,
        title,
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size,
        content: content.trim(),
      })
    } catch (error) {
      try {
        await releaseMaterialCapacity(req.userId, req.file.size)
      } catch (releaseError) {
        console.error("Failed to release material quota after upload failure:", releaseError)
      }
      throw error
    }

    res.status(201).json({
      success: true,
      message:
        "Study material uploaded successfully",
      material,
    })
  } catch (error) {
    console.error(
      "Upload material error:",
      error,
    )

    // Try to remove uploaded file if something
    // failed after multer saved it.
    if (req.file?.path) {
      try {
        await fs.promises.unlink(
          req.file.path,
        )
      } catch {
        // Ignore cleanup error
      }
    }

    res.status(500).json({
      success: false,
      message:
        "Unable to process study material",
    })
  }
}

// =========================================================
// CREATE TEXT MATERIAL
// =========================================================

export const createTextMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      title,
      content,
    } = req.body as {
      title?: string
      content?: string
    }

    if (!content?.trim()) {
      res.status(400).json({
        success: false,
        message:
          "Paste some study text first",
      })

      return
    }

    const newMaterialSize =
      Buffer.byteLength(
        content,
        "utf8",
      )

    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    const capacity = await reserveMaterialCapacity(
      req.userId,
      newMaterialSize,
    )
    if (!capacity.allowed) {
      respondWithLimit(res, capacity)
      return
    }

    const materialTitle =
      title?.trim() ||
      "Pasted study material"

    let material
    try {
      material = await Material.create({
        userId: req.userId,
        title: materialTitle,
        originalName:
          `${materialTitle}.txt`,
        fileName: "",
        filePath: "",
        mimeType: "text/plain",
        size: newMaterialSize,
        content: content.trim(),
      })
    } catch (error) {
      try {
        await releaseMaterialCapacity(req.userId, newMaterialSize)
      } catch (releaseError) {
        console.error("Failed to release material quota after text-save failure:", releaseError)
      }
      throw error
    }

    res.status(201).json({
      success: true,
      message:
        "Study text saved successfully",
      material,
    })
  } catch (error) {
    console.error(
      "Create text material error:",
      error,
    )

    res.status(500).json({
      success: false,
      message:
        "Unable to save study text",
    })
  }
}

// =========================================================
// DELETE MATERIAL
// =========================================================

export const deleteMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const material =
      await Material.findOne({
        _id: req.params.id,
        userId: req.userId,
      })

    if (!material) {
      res.status(404).json({
        success: false,
        message: "Material not found",
      })

      return
    }
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      })
      return
    }

    // Delete physical file
    if (material.filePath) {
      try {
        await fs.promises.unlink(
          material.filePath,
        )
      } catch (fileError) {
        console.warn(
          "Could not delete physical material file:",
          fileError,
        )
      }
    }

    // Delete database record
    await Material.deleteOne({
      _id: material._id,
      userId: req.userId,
    })
    await releaseMaterialCapacity(req.userId, material.size)

    res.status(200).json({
      success: true,
      message:
        "Material deleted successfully",
    })
  } catch (error) {
    console.error(
      "Delete material error:",
      error,
    )

    res.status(500).json({
      success: false,
      message:
        "Failed to delete material",
    })
  }
}