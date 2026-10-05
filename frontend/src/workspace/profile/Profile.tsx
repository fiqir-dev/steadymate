import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Save, UserRound } from "lucide-react"

import TelegramVerification from "../../TelegramVerification"
import PlanUsage from "../PlanUsage"
import type { PlanUsageData } from "../PlanUsage"
import "./Profile.css"

type Profile = {
  name: string
  email: string
  grade: string
  createdAt: string
  profilePicture?: string
  telegramVerified: boolean
  isPremium?: boolean
  premiumExpiresAt?: string | null
  role?: string
  referralCode?: string
}

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"

function Profile() {
  const navigate = useNavigate()

  const [profile, setProfile] =
    useState<Profile | null>(null)
  const [planUsage, setPlanUsage] =
    useState<PlanUsageData | null>(null)

  const [name, setName] = useState("")
  const [grade, setGrade] = useState("")
  const [password, setPassword] = useState("")

  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const saveInFlight = useRef(false)

  useEffect(() => {
    let active = true
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) return

    fetch(`${API_URL}/api/auth/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.message || "Unable to load plan usage")
        }
        return data as PlanUsageData
      })
      .then((usage) => {
        if (active) setPlanUsage(usage)
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load plan usage",
          )
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const token = sessionStorage.getItem(
      "steadymate_token",
    )

    if (!token) {
      navigate("/login")
      return
    }

    fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load profile",
          )
        }

        return data.user as Profile
      })
      .then((user) => {
        setProfile(user)
        setName(user.name)
        setGrade(user.grade || "")
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load profile",
        )
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [navigate])

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    if (saveInFlight.current) return

    setError("")
    setMessage("")
    saveInFlight.current = true
    setIsSaving(true)

    try {
      const token = sessionStorage.getItem(
        "steadymate_token",
      )

      const response = await fetch(
        `${API_URL}/api/auth/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token || ""}`,
          },
          body: JSON.stringify({
            name,
            grade,
            password,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update profile",
        )
      }

      setProfile(data.user)
      setName(data.user.name)
      setGrade(data.user.grade || "")
      setPassword("")
      setHasChanges(false)
      setMessage("Profile updated successfully.")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update profile",
      )
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }

  return (
    <div className="profile-page">
      {/* PROFILE HEADER */}

      <section className="profile-hero">
        <div className="profile-avatar">
          {profile?.profilePicture ? (
            <img
              src={profile.profilePicture}
              alt=""
            />
          ) : (
            <span>
              {profile?.name
                ?.trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase() || <UserRound size={28} />}
            </span>
          )}
        </div>

        <div className="profile-hero-text">
          <span className="profile-kicker">
            STUDENT PROFILE
          </span>

          <h2>
            {profile?.name || "Your profile"}
          </h2>

          <p>
            Keep your student information up to date.
          </p>
        </div>
      </section>

      <TelegramVerification />
      {planUsage && <PlanUsage data={planUsage} />}

      {profile && (
        <section className="profile-card account-status-card">
          <div className="profile-card-header">
            <div>
              <span className="profile-kicker">ACCOUNT STATUS</span>
              <h3>{profile.isPremium ? "PREMIUM" : "FREE PLAN"}</h3>
            </div>
            {profile.isPremium ? (
              <span className="profile-plan-badge premium">Premium</span>
            ) : (
              <span className="profile-plan-badge free">Free</span>
            )}
          </div>

          <div className="account-status-grid">
            <div>
              <small>Current plan</small>
              <strong>{profile.isPremium ? "Premium" : "Free"}</strong>
            </div>
            <div>
              <small>AI Tutor usage today</small>
              <strong>{planUsage ? `${planUsage.usage.aiTutor.used} / ${planUsage.usage.aiTutor.limit}` : "—"}</strong>
            </div>
            <div>
              <small>Premium status</small>
              <strong>{profile.isPremium ? "Active" : "Not active"}</strong>
            </div>
            <div>
              <small>Premium expires</small>
              <strong>{profile.premiumExpiresAt ? new Date(profile.premiumExpiresAt).toLocaleDateString() : "Not active"}</strong>
            </div>
          </div>

          {profile.isPremium ? (
            <div className="account-bonuses">
              <p>Premium benefits include higher usage limits, premium study access, and referral earning potential.</p>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => navigate("/premium")}>
              Get Premium
            </button>
          )}

          {(profile.referralCode || profile.role === "admin") && (
            <div className="account-status-referrals">
              <div>
                <small>Referral code</small>
                <strong>{profile.referralCode || "N/A"}</strong>
              </div>
              <div>
                <small>Referral link</small>
                <strong>{profile.referralCode ? `${window.location.origin}/signup?ref=${profile.referralCode}` : "N/A"}</strong>
              </div>
            </div>
          )}
        </section>
      )}

      {/* LOADING */}

      {isLoading && (
        <section className="profile-card">
          <div className="profile-loading">
            <div className="profile-loading-spinner" />
            <span>Loading your profile...</span>
          </div>
        </section>
      )}

      {/* ERROR */}

      {error && (
        <div className="profile-error" role="alert">
          {error}
        </div>
      )}

      {/* PROFILE FORM */}

      {!isLoading && profile && (
        <form
          className="profile-card"
          onSubmit={handleSubmit}
        >
          <div className="profile-card-header">
            <div>
              <span className="profile-kicker">
                ACCOUNT INFORMATION
              </span>

              <h3>Personal details</h3>

              <p>
                Update the information connected to
                your Steady Mate account.
              </p>
              {profile.createdAt && (
                <p className="profile-account-meta">
                  Member since{" "}
                  {new Intl.DateTimeFormat(undefined, {
                    month: "long",
                    year: "numeric",
                  }).format(new Date(profile.createdAt))}
                </p>
              )}
            </div>

            <span className="profile-status">
              <span />
              Account active
            </span>
          </div>

          <div className="profile-divider" />

          <div className="profile-fields">
            <label className="profile-field">
              <span>Full name</span>

              <input
                value={name}
                disabled={isSaving}
                onChange={(event) => {
                  setName(event.target.value)
                  setHasChanges(true)
                  setMessage("")
                }}
                autoComplete="name"
                placeholder="Your full name"
              />
            </label>

            <label className="profile-field">
              <span>Email address</span>

              <input
                value={profile.email}
                readOnly
                aria-readonly="true"
              />

              <small>
                Your email address cannot be changed
                here.
              </small>
            </label>

            <label className="profile-field">
              <span>Grade or level</span>

              <select
                value={grade}
                disabled={isSaving}
                onChange={(event) => {
                  setGrade(event.target.value)
                  setHasChanges(true)
                  setMessage("")
                }}
              >
                <option value="">
                  Select your grade or level
                </option>

                <option value="Grade 1">Grade 1</option>
                <option value="Grade 2">Grade 2</option>
                <option value="Grade 3">Grade 3</option>
                <option value="Grade 4">Grade 4</option>
                <option value="Grade 5">Grade 5</option>
                <option value="Grade 6">Grade 6</option>
                <option value="Grade 7">Grade 7</option>
                <option value="Grade 8">Grade 8</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
                <option value="University">
                  University
                </option>
                <option value="Other">Other</option>
              </select>
            </label>
          </div>

          {/* SECURITY */}

          <div className="profile-security">
            <div className="profile-security-heading">
              <span className="profile-kicker">
                SECURITY
              </span>

              <h3>Password</h3>

              <p>
                Enter a new password only if you want
                to change your current one.
              </p>
            </div>

            <label className="profile-field">
              <span>New password</span>

              <input
                type="password"
                value={password}
                disabled={isSaving}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setHasChanges(true)
                  setMessage("")
                }}
                placeholder="Leave blank to keep current password"
                autoComplete="new-password"
              />
            </label>
          </div>

          {/* FOOTER */}

          <div className="profile-form-footer">
            <p
              className={
                message
                  ? "profile-message success"
                  : "profile-message"
              }
            >
              {message ||
                "Your changes will be saved to your account."}
            </p>

            <button
              className="profile-save-button"
              type="submit"
              disabled={isSaving || !hasChanges}
            >
              <Save size={17} />

              {isSaving
                ? "Saving..."
                : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default Profile