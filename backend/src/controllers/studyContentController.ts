import { Request, Response } from "express"
import mongoose from "mongoose"

import { Material } from "../models/Material"
import { StudyContent } from "../models/StudyContent"

type ShortNotesPayload = {
  depth?: "quick" | "standard" | "detailed" | "deep"
  organization?: "whole" | "section" | "chapter"
  coreIdeas: string[]
  keyDefinitions: Array<{
    term: string
    definition: string
  }>
  importantFacts: string[]
  processes: string[]
  quickRevision: string
  sectionOverview?: string
  detailedExplanation?: string
  importantRelationships?: string[]
  examples?: string[]
  commonMistakes?: string[]
  sections?: Array<{
    title: string
    coreIdeas: string[]
    keyDefinitions: Array<{
      term: string
      definition: string
    }>
    importantFacts: string[]
    processes: string[]
    quickRevision: string
    sectionOverview?: string
    detailedExplanation?: string
    importantRelationships?: string[]
    examples: string[]
    commonMistakes: string[]
  }>
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "string")

const isShortNotes = (value: unknown): value is ShortNotesPayload => {
  if (!value || typeof value !== "object") return false

  const notes = value as Record<string, unknown>

  return (
    isStringArray(notes.coreIdeas) &&
    Array.isArray(notes.keyDefinitions) &&
    notes.keyDefinitions.every(
      (definition) =>
        !!definition &&
        typeof definition === "object" &&
        typeof (definition as Record<string, unknown>).term ===
          "string" &&
        typeof (definition as Record<string, unknown>).definition ===
          "string",
    ) &&
    isStringArray(notes.importantFacts) &&
    isStringArray(notes.processes) &&
    typeof notes.quickRevision === "string" &&
    (notes.sectionOverview === undefined ||
      typeof notes.sectionOverview === "string") &&
    (notes.detailedExplanation === undefined ||
      typeof notes.detailedExplanation === "string") &&
    (notes.importantRelationships === undefined ||
      isStringArray(notes.importantRelationships)) &&
    (notes.examples === undefined ||
      isStringArray(notes.examples)) &&
    (notes.commonMistakes === undefined ||
      isStringArray(notes.commonMistakes)) &&
    (notes.sections === undefined ||
      (Array.isArray(notes.sections) &&
        notes.sections.every(
          (section) =>
            !!section &&
            typeof section === "object" &&
            typeof (section as Record<string, unknown>).title ===
              "string" &&
            isStringArray(
              (section as Record<string, unknown>).coreIdeas,
            ) &&
            Array.isArray(
              (section as Record<string, unknown>).keyDefinitions,
            ) &&
            isStringArray(
              (section as Record<string, unknown>).importantFacts,
            ) &&
            isStringArray(
              (section as Record<string, unknown>).processes,
            ) &&
            typeof (section as Record<string, unknown>)
              .quickRevision === "string" &&
            ((section as Record<string, unknown>)
              .sectionOverview === undefined ||
              typeof (section as Record<string, unknown>)
                .sectionOverview === "string") &&
            ((section as Record<string, unknown>)
              .detailedExplanation === undefined ||
              typeof (section as Record<string, unknown>)
                .detailedExplanation === "string") &&
            ((section as Record<string, unknown>)
              .importantRelationships === undefined ||
              isStringArray(
                (section as Record<string, unknown>)
                  .importantRelationships,
              )) &&
            isStringArray(
              (section as Record<string, unknown>).examples,
            ) &&
            isStringArray(
              (section as Record<string, unknown>).commonMistakes,
            ),
        ))) &&
    (notes.depth === undefined ||
      ["quick", "standard", "detailed", "deep"].includes(
        notes.depth as string,
      )) &&
    (notes.organization === undefined ||
      ["whole", "section", "chapter"].includes(
        notes.organization as string,
      ))
  )
}

const getRequestIds = (req: Request) => {
  const userId = req.userId
  const materialId = req.params.materialId

  if (
    !userId ||
    !mongoose.Types.ObjectId.isValid(userId) ||
    typeof materialId !== "string" ||
    !mongoose.Types.ObjectId.isValid(materialId)
  ) {
    return null
  }

  return {
    userId: new mongoose.Types.ObjectId(userId),
    materialId: new mongoose.Types.ObjectId(materialId),
  }
}

const getOwnedMaterial = async (
  userId: mongoose.Types.ObjectId,
  materialId: mongoose.Types.ObjectId,
) =>
  Material.findOne({ _id: materialId, userId }).select("title")

export const getStudyContent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ids = getRequestIds(req)

    if (!ids) {
      res.status(400).json({
        success: false,
        message: "Invalid study material",
      })
      return
    }

    const material = await getOwnedMaterial(
      ids.userId,
      ids.materialId,
    )

    if (!material) {
      res.status(404).json({
        success: false,
        message: "Study material not found",
      })
      return
    }

    const studyContent = await StudyContent.findOne(ids).lean()

    res.status(200).json({
      success: true,
      studyContent: studyContent || {
        materialId: ids.materialId,
        materialTitle: material.title,
        shortNotes: null,
        flashcards: [],
      },
    })
  } catch (error) {
    console.error("Get study content error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load saved study content",
    })
  }
}

export const saveShortNotes = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ids = getRequestIds(req)
    const shortNotes = req.body?.shortNotes

    if (!ids) {
      res.status(400).json({
        success: false,
        message: "Invalid study material",
      })
      return
    }

    if (!isShortNotes(shortNotes)) {
      res.status(400).json({
        success: false,
        message: "Invalid short notes data",
      })
      return
    }

    const material = await getOwnedMaterial(
      ids.userId,
      ids.materialId,
    )

    if (!material) {
      res.status(404).json({
        success: false,
        message: "Study material not found",
      })
      return
    }

    const studyContent = await StudyContent.findOneAndUpdate(
      ids,
      {
        $set: {
          materialTitle: material.title,
          shortNotes,
          shortNotesGeneratedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean()

    res.status(200).json({
      success: true,
      studyContent,
    })
  } catch (error) {
    console.error("Save short notes error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to save short notes",
    })
  }
}

export const saveFlashcards = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ids = getRequestIds(req)
    const flashcards = req.body?.flashcards

    if (!ids) {
      res.status(400).json({
        success: false,
        message: "Invalid study material",
      })
      return
    }

    if (
      !Array.isArray(flashcards) ||
      flashcards.length === 0 ||
      flashcards.length > 100 ||
      !flashcards.every(
        (card) =>
          !!card &&
          typeof card.question === "string" &&
          card.question.trim().length > 0 &&
          typeof card.answer === "string" &&
          card.answer.trim().length > 0,
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid flashcard data",
      })
      return
    }

    const material = await getOwnedMaterial(
      ids.userId,
      ids.materialId,
    )

    if (!material) {
      res.status(404).json({
        success: false,
        message: "Study material not found",
      })
      return
    }

    const savedCards = flashcards.map((card, index) => ({
      index,
      question: card.question.trim(),
      answer: card.answer.trim(),
      known: false,
    }))

    const studyContent = await StudyContent.findOneAndUpdate(
      ids,
      {
        $set: {
          materialTitle: material.title,
          flashcards: savedCards,
          flashcardsGeneratedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean()

    res.status(200).json({
      success: true,
      studyContent,
    })
  } catch (error) {
    console.error("Save flashcards error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to save flashcards",
    })
  }
}

export const updateFlashcardProgress = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ids = getRequestIds(req)
    const rawCardIndex = req.params.cardIndex
    const cardIndex =
      typeof rawCardIndex === "string"
        ? Number(rawCardIndex)
        : Number.NaN
    const { known } = req.body as { known?: boolean }

    if (!ids) {
      res.status(400).json({
        success: false,
        message: "Invalid study material",
      })
      return
    }

    if (
      !Number.isInteger(cardIndex) ||
      cardIndex < 0 ||
      typeof known !== "boolean"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid flashcard progress",
      })
      return
    }

    const material = await getOwnedMaterial(
      ids.userId,
      ids.materialId,
    )

    if (!material) {
      res.status(404).json({
        success: false,
        message: "Study material not found",
      })
      return
    }

    const studyContent = await StudyContent.findOneAndUpdate(
      {
        ...ids,
        "flashcards.index": cardIndex,
      },
      {
        $set: {
          "flashcards.$.known": known,
          materialTitle: material.title,
          flashcardsStudiedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    ).lean()

    if (!studyContent) {
      res.status(404).json({
        success: false,
        message: "Flashcard not found",
      })
      return
    }

    res.status(200).json({
      success: true,
      studyContent,
    })
  } catch (error) {
    console.error("Update flashcard progress error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to update flashcard progress",
    })
  }
}
