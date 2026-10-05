import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowUpRight, Check, Sparkles } from "lucide-react"

import PlanUsage from "../PlanUsage"
import type { PlanUsageData } from "../PlanUsage"
import "./Premium.css"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

type ComparisonRow = {
  feature: string
  freeValue: string
  premiumValue: string
  highlight?: boolean
}

type PremiumStatus = {
  isPremium: boolean
  expiresAt: string | null
}

type PaymentStatus = {
  id: string
  status: "pending" | "approved" | "rejected"
  submittedAt: string
}

const comparisonRows: ComparisonRow[] = [
  { feature: "Study materials", freeValue: "Normal access", premiumValue: "Full access" },
  { feature: "Short Notes", freeValue: "Included", premiumValue: "Included + better limits" },
  { feature: "Flashcards", freeValue: "Included", premiumValue: "Included + better limits" },
  { feature: "Quizzes", freeValue: "Included", premiumValue: "Included + better limits" },
  { feature: "AI Tutor", freeValue: "Limited daily access", premiumValue: "Higher / unlimited access according to quota", highlight: true },
  { feature: "Premium features", freeValue: "Limited", premiumValue: "Full access" },
  { feature: "Referral rewards", freeValue: "Available after qualifying signup", premiumValue: "Available to earn as referrer" },
  { feature: "Account badge", freeValue: "No", premiumValue: "Premium account badge/status" },
]

function Premium() {
  const navigate = useNavigate()
  const [usage, setUsage] = useState<PlanUsageData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus | null>(null)
  const [payments, setPayments] = useState<PaymentStatus[]>([])

  useEffect(() => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) {
      navigate("/login")
      return
    }

    fetch(`${API_URL}/api/auth/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.message || "Unable to load plan information")
        }
        setUsage(data as PlanUsageData)
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load plan information",
        )
      })
      .finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) return

    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${API_URL}/api/auth/premium`, { headers }),
      fetch(`${API_URL}/api/premium/payments/my`, { headers }),
    ])
      .then(async ([statusResponse, paymentsResponse]) => {
        const [statusData, paymentData] = await Promise.all([
          statusResponse.json(),
          paymentsResponse.json(),
        ])
        if (!statusResponse.ok || !paymentsResponse.ok) {
          throw new Error(
            statusData.message || paymentData.message || "Unable to load Premium status",
          )
        }
        setPremiumStatus(statusData.premium)
        setPayments(paymentData.payments || [])
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load Premium status",
        )
      })
  }, [])

  const openTelegramBot = () => {
    window.open("https://t.me/steadymatesupport_bot?start=premium", "_blank", "noopener,noreferrer")
  }

  return (
    <div className="premium-page">
      <header className="premium-page-header">
        <p className="premium-eyebrow">PREMIUM ACCESS</p>
        <h1>Upgrade your learning with Steady Mate Premium.</h1>
        <p>
          Premium gives you higher usage limits, better study access, and a more complete learning experience.
        </p>
      </header>

      {loading && <div className="premium-state">Loading your plan...</div>}
      {error && <div className="premium-error">{error}</div>}
      {usage && <PlanUsage data={usage} />}

      <section className="premium-offer-card" aria-labelledby="premium-offer-title">
        <div>
          <span className="premium-offer-icon"><Sparkles size={20} /></span>
          <p className="premium-eyebrow">PREMIUM</p>
          <h2 id="premium-offer-title">More time, more access, more progress.</h2>
          <p>
            Upgrade today for {usage ? `${usage.premiumPrice.amount} ETB` : "the monthly price"} per month and unlock a stronger study flow.
          </p>
        </div>

        <div className="premium-price">
          <strong>{usage ? `${usage.premiumPrice.amount} ETB` : "Loading"}</strong>
          <span>/ month</span>
        </div>
      </section>

      <section className="premium-comparison" aria-labelledby="premium-comparison-title">
        <div className="premium-comparison-heading">
          <p className="premium-eyebrow">PLAN COMPARISON</p>
          <h2 id="premium-comparison-title">Free vs Premium</h2>
        </div>

        <div className="premium-table-wrap">
          <table className="premium-table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Free</th>
                <th scope="col">Premium</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(({ feature, freeValue, premiumValue, highlight }) => (
                <tr key={feature} className={highlight ? "premium-ai-row" : ""}>
                  <th scope="row">
                    {feature}
                    {highlight && <span>KEY DIFFERENCE</span>}
                  </th>
                  <td>{freeValue}</td>
                  <td>{premiumValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="premium-payment-status">
        <div>
          <p className="premium-eyebrow">GET PREMIUM</p>
          <h2>{premiumStatus?.isPremium ? "Your Premium plan is active." : "Start with a manual verification payment."}</h2>
          <p>
            {premiumStatus?.isPremium
              ? `Premium access is active${premiumStatus.expiresAt ? ` until ${new Date(premiumStatus.expiresAt).toLocaleDateString()}` : ""}.`
              : "Transfer the monthly amount and send your Steady Mate email and payment screenshot to our Telegram support bot. An admin must approve the payment before Premium is activated."}
          </p>
        </div>

        <div className="premium-pending-actions">
          {!premiumStatus?.isPremium && (
            <button type="button" className="btn btn-primary" onClick={openTelegramBot}>
              Get Premium <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      </section>

      {payments.length > 0 && (
        <section className="premium-payment-status">
          <div>
            <p className="premium-eyebrow">PAYMENT HISTORY</p>
            <h2>Verification status</h2>
            {payments.map((payment) => (
              <p key={payment.id}>
                {new Date(payment.submittedAt).toLocaleDateString()} — {payment.status}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="premium-payment-status premium-manual-info">
        <div>
          <p className="premium-eyebrow">MANUAL REVIEW</p>
          <h2>How Premium activation works</h2>
          <ul className="premium-checklist">
            <li><Check size={16} /> Premium costs {usage ? `${usage.premiumPrice.amount} ETB` : "the monthly price"} per month.</li>
            <li><Check size={16} /> Transfer the payment to the support account shared in the Telegram bot.</li>
            <li><Check size={16} /> Send your Steady Mate email, then a screenshot after payment. Never send your password.</li>
            <li><Check size={16} /> An admin reviews the payment manually before activating Premium.</li>
          </ul>
        </div>
      </section>

      <Link className="premium-back-link" to="/dashboard">Back to Dashboard</Link>
    </div>
  )
}

export default Premium
