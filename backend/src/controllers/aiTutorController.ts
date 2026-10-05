import { Request, Response } from "express"
import Groq from "groq-sdk"
import mongoose from "mongoose"

import { Material } from "../models/Material"
import { consumeRequestFeatureUsage } from "../middleware/planLimits"

import {
  generateFlashcards,
  generateQuiz,
  generateShortNotes,
} from "../services/ai/aiService"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

/* =========================================================
   AI TUTOR
   ========================================================= */

export const chatWithTutor = async (
  req: Request,
  res: Response
): Promise<void> => {
  const {
    message,
    materialId,
    history,
  } = req.body as {
    message?: string
    materialId?: string
    history?: ChatMessage[]
  }

  if (!message?.trim()) {
    res.status(400).json({
      success: false,
      message: "Write a message first",
    })

    return
  }

  if (!process.env.GROQ_API_KEY) {
    res.status(503).json({
      success: false,
      message:
        "SteadyMate AI is not configured yet.",
    })

    return
  }

  try {
    if (
      materialId &&
      !mongoose.Types.ObjectId.isValid(materialId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid study material",
      })
      return
    }

    const material = materialId
      ? await Material.findOne({
          _id: materialId,
          userId: req.userId,
        }).select("title originalName content")
      : null

    if (materialId && !material) {
      res.status(404).json({
        success: false,
        message: "Study material not found",
      })
      return
    }

    if (!(await consumeRequestFeatureUsage(req, res, "aiTutor"))) {
      return
    }

    const materialContext = material
      ? `
The student selected this study material:

Title: ${material.title}

File: ${material.originalName}

Study material:
${(material.content || "No readable text is available.").slice(0, 12000)}
`
      : "No study material is currently selected."

    const messages = [
      {
        role: "system" as const,
        content: `
You are SteadyMate AI, a calm and helpful study tutor.

Your job is to help students understand what they are studying.

Rules:
- Explain concepts clearly.
- Use simple student-friendly language.
- Break difficult topics into smaller steps.
- Use examples when helpful.
- When study material is provided, use it as your primary context.
- Do not invent facts that contradict the study material.
- If the question is unclear, ask a short clarifying question.
- Be concise but useful.

${materialContext}
`,
      },

      ...(Array.isArray(history)
        ? history
            .filter(
              (item) =>
                item &&
                (
                  item.role === "user" ||
                  item.role === "assistant"
                ) &&
                typeof item.content ===
                  "string"
            )
            .slice(-12)
        : []),

      {
        role: "user" as const,
        content: message.trim(),
      },
    ]

    const completion =
      await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        temperature: 0.4,
        max_completion_tokens: 4096,
        reasoning_effort: "low",
        messages,
      })

    const choice = completion.choices[0]
    const reply =
      choice?.message?.content?.trim()

    if (!reply) {
      console.error("AI Tutor returned no message content", {
        model: completion.model,
        choiceCount: completion.choices.length,
        finishReason: choice?.finish_reason,
        messageFields: choice?.message
          ? Object.keys(choice.message)
          : [],
        reasoningPresent: Boolean(choice?.message?.reasoning),
        usage: completion.usage,
      })
      res.status(502).json({
        success: false,
        message: "SteadyMate AI returned an empty response",
      })

      return
    }

    res.status(200).json({
      success: true,
      reply,
    })
  } catch (error) {
    console.error(
      "Groq AI Tutor error:",
      error
    )

    res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? `SteadyMate AI request failed: ${error.message}`
          : "SteadyMate AI could not be reached",
    })
  }
}

/* =========================================================
   GENERATE SHORT NOTES
   ========================================================= */

export const generateStudyMaterial = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      materialId,
      subject,
      depth = "standard",
      organization = "whole",
    } = req.body as {
      materialId?: string
      subject?: string
      depth?: "quick" | "standard" | "detailed" | "deep"
      organization?: "whole" | "section" | "chapter"
    }

    if (!materialId) {
      res.status(400).json({
        success: false,
        message:
          "Material ID is required",
      })

      return
    }

    if (!["quick", "standard", "detailed", "deep"].includes(depth)) {
      res.status(400).json({
        success: false,
        message: "Invalid note depth",
      })
      return
    }

    if (
      !["whole", "section", "chapter"].includes(organization)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid notes organization",
      })
      return
    }

    const material =
      await Material.findOne({
        _id: materialId,
        userId: req.userId,
      }).select(
        "title content"
      )

    if (!material) {
      res.status(404).json({
        success: false,
        message:
          "Study material not found",
      })

      return
    }

    if (!material.content?.trim()) {
      res.status(400).json({
        success: false,
        message:
          "This study material does not contain readable text yet.",
      })

      return
    }

    if (!(await consumeRequestFeatureUsage(req, res, "notes"))) {
      return
    }

    const shortNotes =
      await generateShortNotes(
        material.content,
        subject || material.title,
        depth,
        organization,
      )

    res.status(200).json({
      success: true,

      material: {
        id: material._id,
        title: material.title,
      },

      depth: shortNotes.depth,
      organization: shortNotes.organization,
      shortNotes,
    })
  } catch (error) {
    console.error(
      "Short notes generation error:",
      error
    )

    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to generate short notes",
    })
  }
}/* =========================================================
   GENERATE FLASHCARDS
   ========================================================= */

export const generateFlashcardsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      materialId,
      subject,
    } = req.body as {
      materialId?: string
      subject?: string
    }

    if (!materialId) {
      res.status(400).json({
        success: false,
        message: "Material ID is required",
      })

      return
    }

    const material =
      await Material.findOne({
        _id: materialId,
        userId: req.userId,
      }).select("title content")

    if (!material) {
      res.status(404).json({
        success: false,
        message: "Study material not found",
      })

      return
    }

    if (!material.content?.trim()) {
      res.status(400).json({
        success: false,
        message:
          "This study material does not contain readable text yet.",
      })

      return
    }

    if (!(await consumeRequestFeatureUsage(req, res, "flashcards"))) {
      return
    }

    const flashcards =
      await generateFlashcards(
        material.content,
        subject || material.title
      )

    res.status(200).json({
      success: true,
      material: {
        id: material._id,
        title: material.title,
      },
      flashcards,
    })
  } catch (error) {
    console.error(
      "Flashcard generation error:",
      error
    )

    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to generate flashcards",
    })
  }
}

/* =========================================================
   GENERATE QUIZ
   ========================================================= */

export const generateQuizController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      materialId,
      subject,
      difficulty = "medium",
    } = req.body as {
      materialId?: string
      subject?: string
      difficulty?: "simple" | "medium" | "hard"
    }

    if (!materialId) {
      res.status(400).json({
        success: false,
        message: "Material ID is required",
      })

      return
    }

    const validDifficulties = [
      "simple",
      "medium",
      "hard",
    ]

    if (!validDifficulties.includes(difficulty)) {
      res.status(400).json({
        success: false,
        message:
          "Invalid quiz difficulty. Choose simple, medium, or hard.",
      })

      return
    }

    const material =
      await Material.findOne({
        _id: materialId,
        userId: req.userId,
      }).select("title content")

    if (!material) {
      res.status(404).json({
        success: false,
        message: "Study material not found",
      })

      return
    }

    if (!material.content?.trim()) {
      res.status(400).json({
        success: false,
        message:
          "This study material does not contain readable text yet.",
      })

      return
    }

    if (!(await consumeRequestFeatureUsage(req, res, "quizzes"))) {
      return
    }

    const quiz =
      await generateQuiz(
        material.content,
        subject || material.title,
        difficulty
      )

    res.status(200).json({
      success: true,
      material: {
        id: material._id,
        title: material.title,
      },
      difficulty,
      quiz,
    })
  } catch (error) {
    console.error(
      "Quiz generation error:",
      error
    )

    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to generate quiz",
    })
  }
}