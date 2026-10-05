import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import BackToHome from "./BackToHome"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (!email.trim() || !password) {
      setError("Email and password are required.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Invalid email or password.")
      }

      if (data.token) {
        sessionStorage.setItem("steadymate_token", data.token)
      }

      navigate("/dashboard")
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "The sign-in server is unavailable. Start the backend and check its database connection."
          : requestError instanceof Error
          ? requestError.message
          : "Login failed. Please try again.",
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
          <Link to="/login" className="active" role="tab" aria-selected="true">Sign in</Link>
          <Link to="/signup" role="tab" aria-selected="false">Create account</Link>
        </div>

        <div className="auth-header">
          <p className="auth-eyebrow">WELCOME BACK</p>
          <h2>Sign in to Steady Mate</h2>
          <p>Continue your study journey with the workspace built for you.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="login-password">Password</label>
          <div className="password-input">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div className="forgot-password-row">
            <Link to="/forgot-password">
              Forgot password?
            </Link>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/signup">Create one</Link>
        </p>
      </section>
    </main>
  )
}

export default Login