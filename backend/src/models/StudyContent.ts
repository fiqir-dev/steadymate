import mongoose, { Document, Schema } from "mongoose"

export interface IStudyContent extends Document {
  userId: mongoose.Types.ObjectId
  materialId: mongoose.Types.ObjectId
  materialTitle: string
  shortNotes?: {
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
  flashcards: Array<{
    index: number
    question: string
    answer: string
    known: boolean
  }>
  shortNotesGeneratedAt?: Date
  flashcardsGeneratedAt?: Date
  flashcardsStudiedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const shortNotesSchema = new Schema(
  {
    depth: {
      type: String,
      enum: ["quick", "standard", "detailed", "deep"],
      default: "standard",
    },
    organization: {
      type: String,
      enum: ["whole", "section", "chapter"],
      default: "whole",
    },
    coreIdeas: { type: [String], default: [] },
    keyDefinitions: {
      type: [
        new Schema(
          {
            term: { type: String, required: true },
            definition: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    importantFacts: { type: [String], default: [] },
    processes: { type: [String], default: [] },
    quickRevision: { type: String, default: "" },
    sectionOverview: { type: String, default: "" },
    detailedExplanation: { type: String, default: "" },
    importantRelationships: { type: [String], default: [] },
    examples: { type: [String], default: [] },
    commonMistakes: { type: [String], default: [] },
    sections: {
      type: [
        new Schema(
          {
            title: { type: String, required: true },
            coreIdeas: { type: [String], default: [] },
            keyDefinitions: {
              type: [
                new Schema(
                  {
                    term: { type: String, required: true },
                    definition: { type: String, required: true },
                  },
                  { _id: false },
                ),
              ],
              default: [],
            },
            importantFacts: { type: [String], default: [] },
            processes: { type: [String], default: [] },
            quickRevision: { type: String, default: "" },
            sectionOverview: { type: String, default: "" },
            detailedExplanation: { type: String, default: "" },
            importantRelationships: { type: [String], default: [] },
            examples: { type: [String], default: [] },
            commonMistakes: { type: [String], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
)

const flashcardSchema = new Schema({
  index: { type: Number, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  known: { type: Boolean, default: false },
})

const studyContentSchema = new Schema<IStudyContent>(
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
      index: true,
    },
    materialTitle: {
      type: String,
      required: true,
    },
    shortNotes: {
      type: shortNotesSchema,
      required: false,
    },
    flashcards: {
      type: [flashcardSchema],
      default: [],
    },
    shortNotesGeneratedAt: { type: Date },
    flashcardsGeneratedAt: { type: Date },
    flashcardsStudiedAt: { type: Date },
  },
  { timestamps: true },
)

studyContentSchema.index(
  { userId: 1, materialId: 1 },
  { unique: true },
)

export const StudyContent = mongoose.model<IStudyContent>(
  "StudyContent",
  studyContentSchema,
)
