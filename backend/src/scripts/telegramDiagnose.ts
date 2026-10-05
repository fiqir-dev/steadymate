import "dotenv/config"

import { diagnoseTelegramWebhook } from "../services/telegramWebhookService"

diagnoseTelegramWebhook()
  .then((status) => {
    console.log(`Bot connected: ${status.botConnected ? "YES" : "NO"}`)
    console.log(`Webhook configured: ${status.webhookConfigured ? "YES" : "NO"}`)
    console.log(`Webhook URL configured: ${status.webhookUrlConfigured ? "YES" : "NO"}`)
    console.log(`Webhook publicly reachable: ${status.webhookPubliclyReachable ? "YES" : "NO"}`)
    console.log(`Registered URL matches configured URL: ${status.webhookUrlMatches ? "YES" : "NO"}`)
    console.log(`Pending updates: ${status.pendingUpdates ?? "unavailable"}`)
    console.log(`Last webhook error: ${status.lastWebhookError}`)
    console.log(
      `Missing environment variables: ${
        status.missingEnvironmentVariables.length
          ? status.missingEnvironmentVariables.join(", ")
          : "none"
      }`,
    )
    if (!status.botConnected || !status.webhookConfigured || !status.webhookPubliclyReachable) {
      process.exitCode = 1
    }
  })
  .catch(() => {
    console.error("Telegram diagnostics failed.")
    process.exitCode = 1
  })
