import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  FileText,
  FolderOpen,
  Layers3,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  UserRound,
} from "lucide-react"
import AppearanceToggle from "./AppearanceToggle"
import BackToHome from "./BackToHome"

type Profile = {
  name: string
  email: string
  grade: string
  createdAt: string
}

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"

const navigation = [
  ["Dashboard", "/dashboard"],
  ["My Materials", "/materials"],
  ["Study", "/study"],
  ["AI Tutor", "/ai-tutor"],
  ["Short Notes", "/notes"],
  ["Flashcards", "/flashcards"],
  ["Quizzes", "/quizzes"],
  ["Progress", "/progress"],
] as const

function getNavigationIcon(label: string) {
  switch (label) {
    case "Dashboard":
      return <BarChart3 size={17} />

    case "My Materials":
      return <FolderOpen size={17} />

    case "Study":
      return <BookOpen size={17} />

    case "AI Tutor":
      return <MessageCircle size={17} />

    case "Short Notes":
      return <FileText size={17} />

    case "Flashcards":
      return <Layers3 size={17} />

    case "Quizzes":
      return <BrainCircuit size={17} />

    case "Progress":
      return <BarChart3 size={17} />

    default:
      return null
  }
}

function Profile() {
  const navigate = useNavigate()
  const location = useLocation()

  const [profile, setProfile] =
    useState<Profile | null>(null)

  const [name, setName] = useState("")
  const [grade, setGrade] = useState("")
  const [password, setPassword] = useState("")

  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const [isLoading, setIsLoading] =
    useState(true)

  const [isSaving, setIsSaving] =
    useState(false)

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(() => window.innerWidth > 900)

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
            data.message ||
              "Unable to load profile",
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

    setError("")
    setMessage("")
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
          data.message ||
            "Unable to update profile",
        )
      }

      setProfile(data.user)
      setName(data.user.name)
      setGrade(data.user.grade || "")
      setPassword("")
      setMessage(
        "Profile updated successfully.",
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update profile",
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleNavigationClick() {
    if (window.innerWidth <= 900) {
      setIsSidebarOpen(false)
    }
  }

  return (
    <main
      className={`workspace-app ${
        isSidebarOpen
          ? "sidebar-open"
          : "sidebar-collapsed"
      }`}
    >
      {/* MOBILE OVERLAY */}

      {isSidebarOpen && (
        <button
          type="button"
          className="workspace-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() =>
            setIsSidebarOpen(false)
          }
        />
      )}

      {/* SIDEBAR */}

      <aside className="workspace-sidebar">
        <div className="workspace-sidebar-top">
          <BackToHome />

          <Link
            to="/dashboard"
            className="workspace-logo"
            onClick={handleNavigationClick}
          >
            <img
              src="/logo.png"
              alt="Steady Mate"
            />
          </Link>

          <div className="workspace-appearance">
            <span>Student workspace</span>
            <AppearanceToggle />
          </div>

          <button
            className="workspace-sidebar-toggle"
            type="button"
            aria-label={
              isSidebarOpen
                ? "Hide sidebar"
                : "Show sidebar"
            }
            title={
              isSidebarOpen
                ? "Hide sidebar"
                : "Show sidebar"
            }
            onClick={() =>
              setIsSidebarOpen(
                (open) => !open,
              )
            }
          >
            {isSidebarOpen ? (
              <PanelLeftClose size={17} />
            ) : (
              <PanelLeftOpen size={17} />
            )}

            <span>
              {isSidebarOpen
                ? "Hide menu"
                : "Show menu"}
            </span>
          </button>
        </div>

        <nav
          className="workspace-nav"
          aria-label="Workspace navigation"
        >
          {navigation.map(
            ([label, path]) => (
              <Link
                key={label}
                to={path}
                className={
                  location.pathname === path
                    ? "active"
                    : ""
                }
                onClick={
                  handleNavigationClick
                }
              >
                <span className="workspace-nav-icon">
                  {getNavigationIcon(label)}
                </span>

                <span>{label}</span>
              </Link>
            ),
          )}
        </nav>

        <div className="workspace-sidebar-bottom">
          <Link
            to="/profile"
            className="active"
            onClick={handleNavigationClick}
          >
            Profile
          </Link>

          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(
                "steadymate_token",
              )

              navigate("/login")
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN */}

      <section className="workspace-main">
        {/* TOPBAR */}

        <header className="workspace-topbar">
          <div>
            <p className="workspace-eyebrow">
              ACCOUNT
            </p>

            <h1>Your profile</h1>

            <p>
              Manage your personal information
              and study details.
            </p>
          </div>
        </header>

        {/* CONTENT */}

        <div className="workspace-content">
          {/* PROFILE INTRO */}

          <section className="profile-intro">
            <div className="profile-avatar">
              <UserRound
                aria-hidden="true"
                size={28}
              />
            </div>

            <div>
              <p className="workspace-eyebrow">
                STUDENT PROFILE
              </p>

              <h2>
                {profile?.name ||
                  "Your profile"}
              </h2>

              <p>
                Keep your student information
                up to date.
              </p>
            </div>
          </section>

          {/* LOADING */}

          {isLoading && (
            <section className="workspace-tool profile-panel">
              <div className="profile-loading">
                Loading your profile...
              </div>
            </section>
          )}

          {/* ERROR */}

          {error && (
            <div
              className="profile-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* PROFILE FORM */}

          {!isLoading && profile && (
            <form
              className="workspace-tool profile-panel profile-form"
              onSubmit={handleSubmit}
            >
              <div className="profile-panel-heading">
                <div>
                  <p className="workspace-eyebrow">
                    ACCOUNT INFORMATION
                  </p>

                  <h2>
                    Personal details
                  </h2>

                  <p>
                    Update the information
                    connected to your Steady Mate
                    account.
                  </p>
                </div>

                <span className="profile-status">
                  Account active
                </span>
              </div>

              <div className="profile-fields">
                <label>
                  <span>Full name</span>

                  <input
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value,
                      )
                    }
                    autoComplete="name"
                    placeholder="Your full name"
                  />
                </label>

                <label>
                  <span>Email address</span>

                  <input
                    value={profile.email}
                    readOnly
                    aria-readonly="true"
                  />

                  <small>
                    Your email address cannot
                    be changed here.
                  </small>
                </label>

                <label>
                  <span>Grade or level</span>

                  <select
                    value={grade}
                    onChange={(event) =>
                      setGrade(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Select your grade or level
                    </option>

                    <option value="Grade 1">
                      Grade 1
                    </option>

                    <option value="Grade 2">
                      Grade 2
                    </option>

                    <option value="Grade 3">
                      Grade 3
                    </option>

                    <option value="Grade 4">
                      Grade 4
                    </option>

                    <option value="Grade 5">
                      Grade 5
                    </option>

                    <option value="Grade 6">
                      Grade 6
                    </option>

                    <option value="Grade 7">
                      Grade 7
                    </option>

                    <option value="Grade 8">
                      Grade 8
                    </option>

                    <option value="Grade 9">
                      Grade 9
                    </option>

                    <option value="Grade 10">
                      Grade 10
                    </option>

                    <option value="Grade 11">
                      Grade 11
                    </option>

                    <option value="Grade 12">
                      Grade 12
                    </option>

                    <option value="University">
                      University
                    </option>

                    <option value="Other">
                      Other
                    </option>
                  </select>
                </label>
              </div>

              {/* SECURITY */}

              <div className="profile-security">
                <div>
                  <p className="workspace-eyebrow">
                    SECURITY
                  </p>

                  <h2>
                    Password
                  </h2>

                  <p>
                    Enter a new password only
                    if you want to change your
                    current one.
                  </p>
                </div>

                <label>
                  <span>New password</span>

                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
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
                      ? "profile-success"
                      : ""
                  }
                >
                  {message ||
                    "Your changes will be saved to your account."}
                </p>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={isSaving}
                >
                  <Save size={16} />

                  {isSaving
                    ? "Saving..."
                    : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

export default Profile