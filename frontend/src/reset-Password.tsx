import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Sparkles,
} from "lucide-react"

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"

function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const token = useMemo(
    () => searchParams.get("token") || "",
    [searchParams],
  )

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError("")

    if (!token) {
      setError(
        "This password reset link is missing or invalid.",
      )
      return
    }

    if (password.length < 6) {
      setError(
        "Your new password must be at least 6 characters.",
      )
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `${API_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            password,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        setError(
          data.message ||
            "Unable to reset your password. Please try again.",
        )
        return
      }

      setSuccess(true)

      setTimeout(() => {
        navigate("/login")
      }, 1800)
    } catch (err) {
      console.error("Reset password error:", err)

      setError(
        "Unable to connect to Steady Mate. Please try again.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="password-screen">
      <div className="password-glow password-glow-one" />
      <div className="password-glow password-glow-two" />

      <Link to="/" className="password-home">
        <ArrowLeft size={16} />
        Back to home
      </Link>

      <main className="password-main">
        {/* LEFT SIDE */}
        <section className="password-intro">
          <div className="password-brand">
            <img src="/logo.png" alt="Steady Mate" />
          </div>

          <h1>
            Almost back in.
            <strong>One more step.</strong>
          </h1>

          <p>
            Create a new password and get back to your
            study space. Your learning journey is waiting.
          </p>

          <div className="password-joke">
            <Sparkles size={16} />
            <span>
              Fresh password. Fresh start. ✨
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
              🚀
            </div>
          </div>
        </section>

        {/* RIGHT SIDE */}
        <section className="password-card">
          <Link to="/login" className="password-back">
            <ArrowLeft size={15} />
            Back to sign in
          </Link>

          {!success ? (
            <>
              <div className="password-icon">
                <LockKeyhole size={23} />
              </div>

              <h2>Create a new password</h2>

              <p className="password-card-text">
                Choose a strong new password for your
                Steady Mate account.
              </p>

              {error && (
                <div className="password-error">
                  {error}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="password-form"
              >
                {/* NEW PASSWORD */}
                <label htmlFor="new-password">
                  New password
                </label>

                <div className="password-input">
                  <LockKeyhole size={17} />

                  <input
                    id="new-password"
                    type={
                      showPassword ? "text" : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current,
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>

                {/* CONFIRM PASSWORD */}
                <label htmlFor="confirm-password">
                  Confirm new password
                </label>

                <div className="password-input">
                  <LockKeyhole size={17} />

                  <input
                    id="confirm-password"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value,
                      )
                    }
                    placeholder="Enter your password again"
                    autoComplete="new-password"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmPassword(
                        (current) => !current,
                      )
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  className="password-button"
                  disabled={loading}
                >
                  {loading
                    ? "Resetting password..."
                    : "Reset password"}
                </button>
              </form>

              <div className="password-footer">
                Remember your password?
                <Link to="/login"> Sign in</Link>
              </div>
            </>
          ) : (
            <div className="password-success-state">
              <div className="password-success-icon">
                <CheckCircle2 size={30} />
              </div>

              <h2>Password reset successfully</h2>

              <p className="password-card-text">
                Your password has been changed.
                Redirecting you to sign in...
              </p>

              <Link
                to="/login"
                className="password-button password-success-link"
              >
                Continue to sign in
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default ResetPassword