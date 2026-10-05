import { Request, Response } from "express"
import mongoose from "mongoose"

import { QuizAttempt } from "../models/QuizAttempt"
import { Material } from "../models/Material"
import { StudyContent } from "../models/StudyContent"

export const saveQuizAttempt = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      materialId,
      difficulty,
      totalQuestions,
      correctAnswers,
      score,
      answers,
    } = req.body

    if (!materialId) {
      res.status(400).json({
        success: false,
        message: "Material ID is required",
      })
      return
    }

    if (
      !mongoose.Types.ObjectId.isValid(materialId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid material ID",
      })
      return
    }

    const material = await Material.findOne({
      _id: materialId,
      userId: req.userId,
    }).select("title")

    if (!material) {
      res.status(404).json({
        success: false,
        message: "Study material not found",
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
        message: "Invalid quiz difficulty",
      })
      return
    }

    if (
      typeof totalQuestions !== "number" ||
      typeof correctAnswers !== "number" ||
      typeof score !== "number" ||
      !Array.isArray(answers)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid quiz result data",
      })
      return
    }

    const quizAttempt = await QuizAttempt.create({
      userId: req.userId,
      materialId,
      materialTitle: material.title,
      difficulty,
      totalQuestions,
      correctAnswers,
      score,
      answers,
    })

    res.status(201).json({
      success: true,
      message: "Quiz attempt saved",
      attempt: quizAttempt,
    })
  } catch (error) {
    console.error(
      "Save quiz attempt error:",
      error,
    )

    res.status(500).json({
      success: false,
      message: "Unable to save quiz attempt",
    })
  }
}

export const getQuizAnalytics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (
      !req.userId ||
      !mongoose.Types.ObjectId.isValid(req.userId)
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication user",
      })
      return
    }

    const userId = new mongoose.Types.ObjectId(req.userId)

    const [summaryResults, recentAttempts, materialPerformance] =
      await Promise.all([
        QuizAttempt.aggregate([
          { $match: { userId } },
          {
            $group: {
              _id: null,
              totalQuizzes: { $sum: 1 },
              averageScore: { $avg: "$score" },
              bestScore: { $max: "$score" },
              totalQuestions: { $sum: "$totalQuestions" },
              totalCorrectAnswers: {
                $sum: "$correctAnswers",
              },
            },
          },
          { $project: { _id: 0 } },
        ]),
        QuizAttempt.find({ userId })
          .select(
            "materialTitle difficulty score correctAnswers totalQuestions createdAt",
          )
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        QuizAttempt.aggregate([
          { $match: { userId } },
          {
            $group: {
              _id: {
                materialId: "$materialId",
                materialTitle: "$materialTitle",
              },
              attempts: { $sum: 1 },
              averageScore: { $avg: "$score" },
              bestScore: { $max: "$score" },
            },
          },
          {
            $project: {
              _id: 0,
              materialId: "$_id.materialId",
              materialTitle: "$_id.materialTitle",
              attempts: 1,
              averageScore: 1,
              bestScore: 1,
            },
          },
          { $sort: { averageScore: -1 } },
        ]),
      ])

    const summary = summaryResults[0] || {
      totalQuizzes: 0,
      averageScore: 0,
      bestScore: 0,
      totalQuestions: 0,
      totalCorrectAnswers: 0,
    }

    res.status(200).json({
      success: true,
      analytics: {
        ...summary,
        recentAttempts,
        materialPerformance,
      },
    })
  } catch (error) {
    console.error("Get quiz analytics error:", error)

    res.status(500).json({
      success: false,
      message: "Unable to load quiz analytics",
    })
  }
}

export const getRecentActivity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (
      !req.userId ||
      !mongoose.Types.ObjectId.isValid(req.userId)
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication user",
      })
      return
    }

    const userId = new mongoose.Types.ObjectId(req.userId)
    const [materials, attempts, studyContents] = await Promise.all([
      Material.find({ userId })
        .select("title createdAt")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      QuizAttempt.find({ userId })
        .select("materialId materialTitle score createdAt")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      StudyContent.find({
        userId,
        $or: [
          { shortNotesGeneratedAt: { $exists: true } },
          { flashcardsGeneratedAt: { $exists: true } },
          { flashcardsStudiedAt: { $exists: true } },
        ],
      })
        .select(
          "materialId materialTitle shortNotesGeneratedAt flashcardsGeneratedAt flashcardsStudiedAt",
        )
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
    ])

    const activities = [
      ...materials.map((material) => ({
        id: `material-${material._id}`,
        type: "material-uploaded" as const,
        description: "Material uploaded",
        title: material.title,
        timestamp: material.createdAt,
        materialId: material._id,
        to: `/study?material=${material._id}`,
      })),
      ...attempts.map((attempt) => ({
        id: `quiz-${attempt._id}`,
        type: "quiz-completed" as const,
        description: "Quiz completed",
        title: attempt.materialTitle,
        score: attempt.score,
        timestamp: attempt.createdAt,
        materialId: attempt.materialId,
        to: `/quizzes?material=${attempt.materialId}`,
      })),
      ...studyContents.flatMap((content) => [
        ...(content.shortNotesGeneratedAt
          ? [{
              id: `notes-${content._id}`,
              type: "notes-generated" as const,
              description: "Short notes generated",
              title: content.materialTitle,
              timestamp: content.shortNotesGeneratedAt,
              materialId: content.materialId,
              to: `/notes?material=${content.materialId}`,
            }]
          : []),
        ...(content.flashcardsGeneratedAt
          ? [{
              id: `flashcards-${content._id}`,
              type: "flashcards-generated" as const,
              description: "Flashcards generated",
              title: content.materialTitle,
              timestamp: content.flashcardsGeneratedAt,
              materialId: content.materialId,
              to: `/flashcards?material=${content.materialId}`,
            }]
          : []),
        ...(content.flashcardsStudiedAt
          ? [{
              id: `flashcards-studied-${content._id}`,
              type: "flashcards-studied" as const,
              description: "Flashcards studied",
              title: content.materialTitle,
              timestamp: content.flashcardsStudiedAt,
              materialId: content.materialId,
              to: `/flashcards?material=${content.materialId}`,
            }]
          : []),
      ]),
    ]
      .sort(
        (first, second) =>
          new Date(second.timestamp).getTime() -
          new Date(first.timestamp).getTime(),
      )
      .slice(0, 8)

    res.status(200).json({
      success: true,
      activities,
    })
  } catch (error) {
    console.error("Get recent activity error:", error)
    res.status(500).json({
      success: false,
      message: "Unable to load recent activity",
    })
  }
}