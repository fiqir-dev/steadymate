import mongoose, { Document, Schema } from "mongoose"

export interface IMaterial extends Document {
  userId: mongoose.Types.ObjectId
  title: string
  originalName: string
  fileName: string
  filePath: string
  mimeType: string
  size: number
  content?: string
  createdAt: Date
  updatedAt: Date
}

const materialSchema = new Schema<IMaterial>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    fileName: { type: String, default: "" },
    filePath: { type: String, default: "" },
    mimeType: { type: String, default: "text/plain" },
    size: { type: Number, default: 0 },
    content: { type: String, default: "" },
  },
  { timestamps: true }
)

export const Material = mongoose.model<IMaterial>("Material", materialSchema)
