const getConfig = () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || "",
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "",
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL?.trim() || "",
})

const isValidSecret = (secret: string) =>
  /^[A-Za-z0-9_-]{32,256}$/.test(secret)

const getApiJson = async <T>(method: string, botToken: string): Promise<T> => {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    signal: AbortSignal.timeout(10000),
  })
  const result = await response.json() as T & {
    ok?: boolean
    description?: string
  }
  if (!response.ok || result.ok !== true) {
    throw new Error(result.description || `Telegram API request failed (${response.status})`)
  }
  return result
}

export const configureTelegramWebhook = async (): Promise<boolean> => {
  const { botToken, webhookSecret, webhookUrl } = getConfig()
  if (!botToken || !webhookSecret || !webhookUrl) {
    console.error(
      "Telegram webhook registration skipped: configure TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_URL, and TELEGRAM_WEBHOOK_SECRET.",
    )
    return false
  }
  if (!isValidSecret(webhookSecret)) {
    console.error("Telegram webhook registration skipped: invalid webhook secret format.")
    return false
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(webhookUrl)
  } catch {
    console.error("Telegram webhook registration skipped: invalid webhook URL.")
    return false
  }
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.pathname.replace(/\/+$/, "") !== "/api/telegram/webhook" ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    console.error(
      "Telegram webhook registration skipped: URL must be public HTTPS and end in /api/telegram/webhook.",
    )
    return false
  }

  try {
    const identity = await getApiJson<{ result?: { username?: string } }>(
      "getMe",
      botToken,
    )
    const configuredUsername = process.env.TELEGRAM_BOT_USERNAME?.trim()
    if (
      configuredUsername &&
      identity.result?.username?.toLowerCase() !== configuredUsername.replace(/^@/, "").toLowerCase()
    ) {
      console.error("Telegram webhook registration failed: configured bot username does not match the token.")
      return false
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["message", "callback_query"],
      }),
      signal: AbortSignal.timeout(10000),
    })
    const result = await response.json() as { ok?: boolean; description?: string }
    if (!response.ok || result.ok !== true) {
      console.error("Telegram webhook registration failed; Telegram rejected the setup request.")
      return false
    }
    console.log("Telegram bot connected; webhook registered successfully.")
    return true
  } catch {
    console.error("Telegram webhook registration failed; check bot credentials and network connectivity.")
    return false
  }
}

export const diagnoseTelegramWebhook = async () => {
  const { botToken, webhookSecret, webhookUrl } = getConfig()
  const status = {
    botConnected: false,
    webhookConfigured: false,
    webhookUrlConfigured: false,
    webhookPubliclyReachable: false,
    webhookUrlMatches: false,
    pendingUpdates: null as number | null,
    lastWebhookError: "None",
    missingEnvironmentVariables: [] as string[],
  }

  if (!botToken) status.missingEnvironmentVariables.push("TELEGRAM_BOT_TOKEN")
  if (!process.env.TELEGRAM_BOT_USERNAME?.trim()) {
    status.missingEnvironmentVariables.push("TELEGRAM_BOT_USERNAME")
  }
  if (!webhookUrl) status.missingEnvironmentVariables.push("TELEGRAM_WEBHOOK_URL")
  if (!webhookSecret) status.missingEnvironmentVariables.push("TELEGRAM_WEBHOOK_SECRET")
  if (!process.env.FRONTEND_URL?.trim()) status.missingEnvironmentVariables.push("FRONTEND_URL")
  status.webhookUrlConfigured = Boolean(
    webhookUrl &&
    (() => {
      try {
        const url = new URL(webhookUrl)
        return url.protocol === "https:" &&
          url.pathname.replace(/\/+$/, "") === "/api/telegram/webhook" &&
          !url.username &&
          !url.password
      } catch {
        return false
      }
    })(),
  )

  if (!botToken) return status

  try {
    const identity = await getApiJson<{ result?: { username?: string } }>("getMe", botToken)
    const configuredUsername = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "")
    status.botConnected = Boolean(
      identity.result?.username &&
      (!configuredUsername ||
        identity.result.username.toLowerCase() === configuredUsername.toLowerCase()),
    )
    const info = await getApiJson<{
      result?: {
        url?: string
        pending_update_count?: number
        last_error_message?: string
      }
    }>("getWebhookInfo", botToken)
    const registeredUrl = info.result?.url || ""
    status.webhookConfigured = Boolean(registeredUrl)
    status.webhookUrlMatches = Boolean(webhookUrl && registeredUrl === webhookUrl)
    status.pendingUpdates = info.result?.pending_update_count ?? 0
    status.lastWebhookError = info.result?.last_error_message
      ? "Telegram reports a delivery error (details withheld)."
      : "None"
  } catch {
    status.botConnected = false
  }

  if (status.webhookUrlConfigured && webhookUrl) {
    try {
      const probe = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Bot-Api-Secret-Token": "diagnostic-invalid-secret",
        },
        body: "{}",
        signal: AbortSignal.timeout(8000),
      })
      status.webhookPubliclyReachable = probe.status === 401
    } catch {
      status.webhookPubliclyReachable = false
    }
  }

  return status
}
