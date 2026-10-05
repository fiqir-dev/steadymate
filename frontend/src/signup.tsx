import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import BackToHome from "./BackToHome"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

function Signup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const referralCode = searchParams.get("ref") || ""

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = () => {
    const nextErrors: Record<string, string> = {}

    if (!name.trim()) {
      nextErrors.name = "Full name is required."
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address."
    }

    if (!password) {
      nextErrors.password = "Password is required."
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters."
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password."
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage("")

    if (!validate()) return

    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          ref: referralCode,
        }),
      })

      const data: { message?: string; token?: string } = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Signup failed. Please try again.")
      }

      if (data.token) {
        sessionStorage.setItem("steadymate_token", data.token)
      }

      navigate("/dashboard")
    } catch (error) {
      setMessage(
        error instanceof TypeError
          ? "The signup server is unavailable. Start the backend and check its database connection."
          : error instanceof Error
          ? error.message
          : "Signup failed. Please try again.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="Steady Mate introduction">
        <BackToHome />
        <Link to="/" className="auth-brand">
          <img src="/logo.png" alt="Steady Mate" />
        </Link>
        <div className="auth-hero-copy">
          <p className="auth-hero-kicker">YOUR STUDY SPACE</p>
          <h1>Everything you need to study smarter, in one place.</h1>
          <p>Turn your materials into clear notes, useful practice, and steady progress.</p>
        </div>
        <div className="auth-hero-points">
          <span>01</span><p>Organize your learning materials</p>
          <span>02</span><p>Practice with focused quizzes</p>
          <span>03</span><p>Build progress you can see</p>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Authentication pages">
          <Link to="/login" role="tab" aria-selected="false">Sign in</Link>
          <Link to="/signup" className="active" role="tab" aria-selected="true">Create account</Link>
        </div>

        <div className="auth-header">
          <p className="auth-eyebrow">GET STARTED</p>
          <h2>Create your Steady Mate account</h2>
          <p>Set up your study space and start learning with more clarity.</p>
        </div>

        <button className="auth-google" type="button" disabled>
          <span aria-hidden="true">G</span>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="signup-name">Full name</label>
          <input
            id="signup-name"
            name="name"
            type="text"
            placeholder="Enter your full name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="auth-error">{errors.name}</p>}

          <label htmlFor="signup-email">Email address</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <p className="auth-error">{errors.email}</p>}

          <label htmlFor="signup-password">Password</label>
          <div className="password-input">
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && <p className="auth-error">{errors.password}</p>}

          <label htmlFor="signup-confirm-password">Confirm password</label>
          <div className="password-input">
            <input
              id="signup-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={Boolean(errors.confirmPassword)}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={
                showConfirmPassword
                  ? "Hide confirmed password"
                  : "Show confirmed password"
              }
              onClick={() => setShowConfirmPassword((visible) => !visible)}
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="auth-error">{errors.confirmPassword}</p>
          )}

          {message && <p className="auth-message">{message}</p>}

          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}

export default Signup