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

export const getTelegramFile = async (fileId: string): Promise<Response> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error("Telegram bot is not configured")

  const metadataResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { signal: AbortSignal.timeout(8000) },
  )
  const metadata = (await metadataResponse.json()) as {
    ok?: boolean
    result?: { file_path?: string }
    description?: string
  }
  if (!metadataResponse.ok || metadata.ok !== true || !metadata.result?.file_path) {
    throw new Error(metadata.description || "Unable to retrieve Telegram screenshot")
  }

  const fileResponse = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${metadata.result.file_path}`,
    { signal: AbortSignal.timeout(15000) },
  )
  if (!fileResponse.ok) throw new Error("Unable to download Telegram screenshot")
  return fileResponse
}
