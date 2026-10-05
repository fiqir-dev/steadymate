import "dotenv/config"

import { configureTelegramWebhook } from "../services/telegramWebhookService"

configureTelegramWebhook()
  .then((configured) => {
    if (!configured) process.exitCode = 1
  })
  .catch(() => {
    console.error("Telegram webhook setup failed.")
    process.exitCode = 1
  })
