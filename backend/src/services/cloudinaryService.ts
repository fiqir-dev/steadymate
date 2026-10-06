import { v2 as cloudinary } from "cloudinary"
import { Readable } from "node:stream"

type CloudinaryScreenshot = {
  secureUrl: string
  publicId: string
}

const configureCloudinary = (): void => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary configuration is incomplete")
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
}

export const uploadPaymentScreenshot = (
  image: Buffer,
): Promise<CloudinaryScreenshot> => {
  configureCloudinary()

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "steadymate/payment-screenshots",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error)
          return
        }
        if (!result?.secure_url || !result.public_id) {
          reject(new Error("Cloudinary did not return a stored screenshot"))
          return
        }

        resolve({ secureUrl: result.secure_url, publicId: result.public_id })
      },
    )

    Readable.from([image]).pipe(uploadStream)
  })
}

export const deletePaymentScreenshot = async (publicId: string): Promise<void> => {
  configureCloudinary()
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" })

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("Cloudinary did not delete the unused screenshot")
  }
}
