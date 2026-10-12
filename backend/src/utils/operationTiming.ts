export const createOperationTimer = (operation: string) => {
  const startedAt = performance.now()
  const stages: Record<string, number> = {}

  return {
    mark(name: string): void {
      stages[name] = Math.round(performance.now() - startedAt)
    },
    stage(name: string, stageStartedAt: number): void {
      stages[name] = Math.round(performance.now() - stageStartedAt)
    },
    finish(extra: Record<string, number | string> = {}): void {
      console.info("SteadyMate operation timing", {
        operation,
        totalMs: Math.round(performance.now() - startedAt),
        ...stages,
        ...extra,
      })
    },
  }
}

export const createGenerationKey = (...parts: string[]): string => {
  return createHash("sha256")
    .update(parts.join("\u0000"))
    .digest("hex")
    .slice(0, 32)
}
import { createHash } from "crypto"
