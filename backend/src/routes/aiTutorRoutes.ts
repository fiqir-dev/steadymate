import express from "express"

import {
  chatWithTutor,
  generateStudyMaterial,
  generateFlashcardsController,
  generateQuizController,
} from "../controllers/aiTutorController"

import { requireAuth } from "../middleware/authMiddleware"

const router = express.Router()

router.post(
  "/chat",
  requireAuth,
  chatWithTutor
)

router.post(
  "/generate",
  requireAuth,
  generateStudyMaterial
)

router.post(
  "/flashcards",
  requireAuth,
  generateFlashcardsController
)

router.post(
  "/quiz",
  requireAuth,
  generateQuizController
)

export default router