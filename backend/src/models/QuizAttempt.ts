import mongoose, { Document, Schema } from "mongoose"

export interface IQuizAttempt extends Document {
  userId: mongoose.Types.ObjectId
  materialId: mongoose.Types.ObjectId
  materialTitle: string
  difficulty: "simple" | "medium" | "hard"
  totalQuestions: number
  correctAnswers: number
  score: number
  answers: Array<{
    questionIndex: number
    selectedAnswer: string
    correctAnswer: string
    isCorrect: boolean
  }>
  createdAt: Date
}

const quizAttemptSchema = new Schema<IQuizAttempt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    materialId: {
      type: Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },

    materialTitle: {
      type: String,
      required: true,
      trim: true,
    },

    difficulty: {
      type: String,
      enum: ["simple", "medium", "hard"],
      required: true,
    },

    totalQuestions: {
      type: Number,
      required: true,
    },

    correctAnswers: {
      type: Number,
      required: true,
    },

    score: {
      type: Number,
      required: true,
    },

    answers: [
      {
        questionIndex: {
          type: Number,
          required: true,
        },

        selectedAnswer: {
          type: String,
          default: "",
        },

        correctAnswer: {
          type: String,
          required: true,
        },

        isCorrect: {
          type: Boolean,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
)

export const QuizAttempt = mongoose.model<IQuizAttempt>(
  "QuizAttempt",
  quizAttemptSchema,
)