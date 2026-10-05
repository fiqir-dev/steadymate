import { Sparkles } from "lucide-react"

import "./AiGenerationStatus.css"

type AiGenerationStatusProps = {
  title: string
  description: string
  detail?: string
  compact?: boolean
}

const visualStages = [
  "Preparing your request",
  "Generating learning resources",
  "Preparing your results",
]

function AiGenerationStatus({
  title,
  description,
  detail,
  compact = false,
}: AiGenerationStatusProps) {
  return (
    <section
      className={`ai-generation-status ${
        compact ? "ai-generation-status-compact" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="ai-generation-orb" aria-hidden="true">
        <span className="ai-generation-orb-ring" />
        <span className="ai-generation-orb-core">
          <Sparkles size={compact ? 20 : 25} />
        </span>
      </div>
      <div className="ai-generation-copy">
        <p className="ai-generation-kicker">STEADY MATE AI</p>
        <h2>{title}</h2>
        <p className="ai-generation-description">{description}</p>
        {detail && <span className="ai-generation-detail">{detail}</span>}
        <ol
          className="ai-generation-stages"
          aria-label="Illustrative generation stages; live progress is not available"
        >
          {visualStages.map((stage, index) => (
            <li className={index === 1 ? "is-active" : ""} key={stage}>
              <span aria-hidden="true" />
              {stage}
            </li>
          ))}
        </ol>
        <span className="ai-generation-note">
          These are visual steps, not live progress updates.
        </span>
      </div>
    </section>
  )
}

export default AiGenerationStatus
