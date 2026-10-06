export const sendTelegramMessage = async (
  chatId: number | string,
  text: string,
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>
  },
): Promise<void> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error("Telegram bot is not configured")

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    },
  )
  const result = (await response.json()) as { ok?: boolean; description?: string }
  if (!response.ok || result.ok !== true) {
    throw new Error(result.description || `Telegram sendMessage failed (${response.status})`)
  }
}

export const answerTelegramCallback = async (
  callbackQueryId: string,
  text: string,
): Promise<void> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error("Telegram bot is not configured")
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
      signal: AbortSignal.timeout(8000),
    },
  )
  const result = (await response.json()) as { ok?: boolean; description?: string }
  if (!response.ok || result.ok !== true) {
    throw new Error(result.description || `Telegram callback response failed (${response.status})`)
  }
}

export const getTelegramFile = async (
  fileId: string,
  reportDiagnostic?: (event: string, details: Record<string, unknown>) => void,
): Promise<Response> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error("Telegram bot is not configured")

  const metadataUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
  reportDiagnostic?.("get_file_request", {
    endpoint: "https://api.telegram.org/bot[REDACTED]/getFile",
    fileIdPresent: Boolean(fileId),
    urlConstructed: true,
  })
  const metadataResponse = await fetch(
    metadataUrl,
    { signal: AbortSignal.timeout(8000) },
  )
  reportDiagnostic?.("get_file_response", {
    httpStatus: metadataResponse.status,
    responseOk: metadataResponse.ok,
  })
  const metadata = (await metadataResponse.json()) as {
    ok?: boolean
    result?: { file_path?: string }
    description?: string
  }
  const filePath = metadata.result?.file_path
  const filePathExtension = filePath?.match(/\.[^.\\/]+$/)?.[0] || ""
  const safeDescription = metadata.description?.replaceAll(botToken, "[REDACTED]")
  reportDiagnostic?.("get_file_result", {
    telegramOk: metadata.ok === true,
    filePathPresent: Boolean(filePath),
    filePathExtension,
    description: safeDescription && fileId
      ? safeDescription.split(fileId).join("[REDACTED]")
      : safeDescription,
  })
  if (!metadataResponse.ok || metadata.ok !== true || !metadata.result?.file_path) {
    throw new Error(metadata.description || "Unable to retrieve Telegram screenshot")
  }

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${metadata.result.file_path}`
  reportDiagnostic?.("file_download_request", {
    endpoint: "https://api.telegram.org/file/bot[REDACTED]/<file_path>",
    filePathPresent: true,
    urlConstructed: true,
  })
  const fileResponse = await fetch(
    fileUrl,
    { signal: AbortSignal.timeout(15000) },
  )
  reportDiagnostic?.("file_download_response", {
    httpStatus: fileResponse.status,
    responseOk: fileResponse.ok,
    contentType: fileResponse.headers.get("content-type") || "",
  })
  if (!fileResponse.ok) throw new Error("Unable to download Telegram screenshot")
  return fileResponse
}
