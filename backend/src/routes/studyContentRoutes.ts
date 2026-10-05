import express from "express"

import {
  getStudyContent,
  saveFlashcards,
  saveShortNotes,
  updateFlashcardProgress,
} from "../controllers/studyContentController"
import { requireAuth } from "../middleware/authMiddleware"

const router = express.Router()

router.get("/:materialId", requireAuth, getStudyContent)
router.put("/:materialId/notes", requireAuth, saveShortNotes)
router.put(
  "/:materialId/flashcards",
  requireAuth,
  saveFlashcards,
)
router.patch(
  "/:materialId/flashcards/:cardIndex",
  requireAuth,
  updateFlashcardProgress,
)

export default router
