import { Link } from "react-router-dom"
import "./PlanUsage.css"

export type UsageEntry = {
  used: number
  limit: number
  remaining: number
  period: "total" | "month" | "day"
  unit?: "bytes"
}

export type PlanUsageData = {
  plan: "free" | "premium"
  premiumPrice: {
    amount: number
    currency: "ETB"
    period: "month"
  }
  usage: {
    materials: UsageEntry
    notes: UsageEntry
    flashcards: UsageEntry
    quizzes: UsageEntry
    aiTutor: UsageEntry
    storage: UsageEntry
    progress: { included: true }
  }
}

type UsageKey =
  | "aiTutor"
  | "notes"
  | "flashcards"
  | "quizzes"
  | "materials"
  | "storage"

const usageRows: Array<{ key: UsageKey; title: string }> = [
  { key: "aiTutor", title: "AI Tutor" },
  { key: "notes", title: "Short Notes" },
  { key: "flashcards", title: "Flashcards" },
  { key: "quizzes", title: "Quizzes" },
  { key: "materials", title: "Materials" },
  { key: "storage", title: "Storage" },
]

const byteUnits = ["B", "KB", "MB", "GB"]

function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  const index = Math.min(
    byteUnits.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  )
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${byteUnits[index]}`
}

function formatUsage(key: UsageKey, entry: UsageEntry) {
  if (key === "storage") {
    return `${formatBytes(entry.used)} / ${formatBytes(entry.limit)}`
  }
  if (key === "aiTutor") {
    return `${entry.used} / ${entry.limit} messages used ${
      entry.period === "day" ? "today (UTC)" : "this month"
    }`
  }
  const period =
    entry.period === "day"
      ? "today"
      : entry.period === "month"
        ? "this month"
        : ""
  return `${entry.used} / ${entry.limit}${period ? ` ${period}` : ""}`
}

function PlanUsage({ data }: { data: PlanUsageData }) {
  return (
    <section className="plan-usage-panel" aria-labelledby="plan-usage-title">
      <header className="plan-usage-header">
        <div>
          <p className="plan-usage-eyebrow">YOUR PLAN</p>
          <h2 id="plan-usage-title">
            {data.plan === "premium" ? "Premium" : "Free"}
          </h2>
          <p>
            {data.plan === "premium"
              ? "Your Premium access is active."
              : "Your study tools and progress tracking are included."}
          </p>
        </div>
        {data.plan === "free" && (
          <Link className="btn btn-primary plan-usage-upgrade" to="/premium">
            Upgrade to Premium
          </Link>
        )}
      </header>
      <div className="plan-usage-grid">
        {usageRows.map(({ key, title }) => {
          const entry = data.usage[key]
          const percentage =
            entry.limit > 0
              ? Math.min(100, Math.round((entry.used / entry.limit) * 100))
              : 0
          return (
            <article className="plan-usage-item" key={key}>
              <div className="plan-usage-item-heading">
                <strong>{title}</strong>
                <span>{formatUsage(key, entry)}</span>
              </div>
              <div
                className="plan-usage-meter"
                role="progressbar"
                aria-label={`${title} usage`}
                aria-valuemin={0}
                aria-valuemax={entry.limit}
                aria-valuenow={Math.min(entry.used, entry.limit)}
              >
                <span
                  className={percentage >= 90 ? "near-limit" : ""}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {key === "aiTutor" && (
                <small>
                  {entry.remaining} message{entry.remaining === 1 ? "" : "s"} remaining{" "}
                  {entry.period === "day" ? "today (UTC)" : "this month"}
                </small>
              )}
            </article>
          )
        })}
      </div>
      <p className="plan-usage-included">
        Progress tracking and basic study tools are included.
      </p>
    </section>
  )
}

export default PlanUsage
