import { useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  Sparkles,
} from "lucide-react"

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"

function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError("")
    setMessage("")

    if (!email.trim()) {
      setError("Please enter your email address.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `${API_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        setError(
          data.message ||
            "Unable to process your request. Please try again.",
        )
        return
      }

      setMessage(
        data.message ||
          "If an account exists with this email, a password reset email will be sent.",
      )
    } catch (err) {
      console.error("Forgot password error:", err)

      setError(
        "Unable to connect to Steady Mate. Please try again.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
      <div className="password-screen forgot-password-screen">
        <div className="password-glow password-glow-one" />
        <div className="password-glow password-glow-two" />

        <Link to="/" className="password-home">
          <ArrowLeft size={16} />
          Back to home
        </Link>

        <main className="password-main">
          <section className="password-intro">
            <div className="password-brand">
              <img src="/logo.png" alt="Steady Mate" />
            </div>

            <h1>
              Forgot your
              <strong>password?</strong>
            </h1>

            <p>
              No stress. Even your memory needs a study
              break sometimes. Enter your email and we'll
              help you get back into your study space.
            </p>

            <div className="password-joke">
              <Sparkles size={16} />
              <span>
                Your notes are safe. We promise. 😌
              </span>
            </div>

            <div className="password-orbit">
              <div className="orbit-center">🔐</div>

              <div className="orbit-item orbit-item-one">
                📚
              </div>

              <div className="orbit-item orbit-item-two">
                🧠
              </div>

              <div className="orbit-item orbit-item-three">
                ✨
              </div>
            </div>
          </section>

          <section className="password-card">
            <Link to="/login" className="password-back">
              <ArrowLeft size={15} />
              Back to sign in
            </Link>

            <div className="password-icon">
              <Mail size={23} />
            </div>

            <h2>Reset your password</h2>

            <p className="password-card-text">
              Enter the email connected to your Steady Mate
              account and we'll send you a secure reset link.
            </p>

            {message && (
              <div className="password-success">
                <CheckCircle2 size={18} />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div className="password-error">
                {error}
              </div>
            )}

            {!message && (
              <form
                onSubmit={handleSubmit}
                className="password-form"
              >
                <label htmlFor="forgot-email">
                  Email address
                </label>

                <div className="password-input">
                  <Mail size={17} />

                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  className="password-button"
                  disabled={loading}
                >
                  {loading
                    ? "Sending reset link..."
                    : "Send reset link"}
                </button>
              </form>
            )}

            <div className="password-footer">
              Remember your password?
              <Link to="/login"> Sign in</Link>
            </div>
          </section>
        </main>
      </div>
  )
}

export default ForgotPassword