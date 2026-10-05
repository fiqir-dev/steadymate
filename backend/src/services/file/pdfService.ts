import fs from "fs"
import { PDFParse } from "pdf-parse"

export const extractPdfText = async (filePath: string): Promise<string> => {
  const fileBuffer = await fs.promises.readFile(filePath)

  const parser = new PDFParse({
    data: fileBuffer,
  })

  try {
    const result = await parser.getText()
    const text = result.text?.trim() || ""

    if (!text) {
      throw new Error("No readable text was found in the PDF")
    }

    return text
  } finally {
    await parser.destroy()
  }
}