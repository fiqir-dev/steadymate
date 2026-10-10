const PRODUCTION_FRONTEND_URL = "https://steadymate.et"
const DEVELOPMENT_FRONTEND_URL = "http://localhost:5173"

export const getFrontendOrigin = (): string => {
  const isProduction = process.env.NODE_ENV === "production"
  const configuredUrls = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  for (const configuredUrl of configuredUrls) {
    try {
      const url = new URL(configuredUrl)
      if (
        (url.protocol === "https:" || (!isProduction && url.protocol === "http:")) &&
        !(isProduction && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))
      ) {
        return url.origin
      }
    } catch {
      continue
    }
  }

  return isProduction
    ? PRODUCTION_FRONTEND_URL
    : DEVELOPMENT_FRONTEND_URL
}
