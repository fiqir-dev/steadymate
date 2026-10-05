import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import BackToHome from "./BackToHome"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
      const response = await fetch(`${API_URL}/api/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Unable to sign in as admin.")
      }

      if (typeof data.token !== "string" || data.user?.role !== "admin") {
        throw new Error("The server did not return a valid admin session.")
      }

      sessionStorage.setItem("steadymate_token", data.token)
      navigate("/admin")
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "The sign-in server is unavailable. Start the backend and check its database connection."
          : requestError instanceof Error
          ? requestError.message
          : "Admin login failed. Please try again.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="Steady Mate administration">
        <BackToHome />
        <Link to="/" className="auth-brand">
          <img src="/logo.png" alt="Steady Mate" />
        </Link>
        <div className="auth-hero-copy">
          <p className="auth-hero-kicker">ADMINISTRATION</p>
          <h1>Manage Steady Mate securely.</h1>
          <p>Sign in with an administrator account to continue to the control center.</p>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-header">
          <p className="auth-eyebrow">ADMIN PORTAL</p>
          <h2>Admin sign in</h2>
          <p>Use your administrator account credentials.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="admin-login-email">Email address</label>
          <input
            id="admin-login-email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="admin-login-password">Password</label>
          <input
            id="admin-login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in to Admin"}
          </button>
        </form>

        <p className="auth-switch">
          Student account? <Link to="/login">Sign in here</Link>
        </p>
      </section>
    </main>
  )
}

export default AdminLogin
