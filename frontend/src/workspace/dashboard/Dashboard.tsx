import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Layers3,
} from "lucide-react"

import PlanUsage from "../PlanUsage"
import type { PlanUsageData } from "../PlanUsage"
import "./Dashboard.css"

type DashboardMaterial = {
  _id: string
  title: string
  originalName: string
  size: number
  createdAt: string
}

type QuizAttemptSummary = {
  _id: string
  materialTitle: string
  difficulty: string
  score: number
  correctAnswers: number
  totalQuestions: number
  createdAt: string
}

type MaterialPerformance = {
  materialId: string
  materialTitle: string
  attempts: number
  averageScore: number
  bestScore: number
}

type RecentActivity = {
  id: string
  type:
    | "material-uploaded"
    | "quiz-completed"
    | "notes-generated"
    | "flashcards-generated"
    | "flashcards-studied"
  description: string
  title: string
  timestamp: string
  score?: number
  materialId?: string
  to: string
}

type QuizAnalytics = {
  totalQuizzes: number
  averageScore: number
  bestScore: number
  totalQuestions: number
  totalCorrectAnswers: number
  recentAttempts: QuizAttemptSummary[]
  materialPerformance: MaterialPerformance[]
}

type DashboardData = {
  name: string
  materials: DashboardMaterial[]
  analytics: QuizAnalytics
  activities: RecentActivity[]
  usage: PlanUsageData
}

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date))
}

function formatRelativeDate(date: string) {
  const timestamp = new Date(date).getTime()
  if (!Number.isFinite(timestamp)) return "Date unavailable"
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60_000),
  )
  if (elapsedMinutes < 1) return "Just now"
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) {
    return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`
  }
  const elapsedDays = Math.floor(elapsedHours / 24)
  if (elapsedDays < 7) {
    return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`
  }
  return formatDate(date)
}

function ActivityIcon({ type }: { type: RecentActivity["type"] }) {
  if (type === "material-uploaded") return <BookOpen size={17} />
  if (type === "quiz-completed") return <CheckCircle2 size={17} />
  if (type === "notes-generated") return <FileText size={17} />
  return <Layers3 size={17} />
}

function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      const token = sessionStorage.getItem("steadymate_token")

      if (!token) {
        navigate("/login")
        return
      }

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        }

        const [
          userResponse,
          materialsResponse,
          analyticsResponse,
          activityResponse,
          usageResponse,
        ] =
          await Promise.all([
            fetch(`${API_URL}/api/auth/me`, { headers }),
            fetch(`${API_URL}/api/materials`, { headers }),
            fetch(`${API_URL}/api/quiz-attempts/analytics`, {
              headers,
            }),
            fetch(`${API_URL}/api/quiz-attempts/activity`, {
              headers,
            }),
            fetch(`${API_URL}/api/auth/usage`, { headers }),
          ])

        const [
          userData,
          materialsData,
          analyticsData,
          activityData,
          usageData,
        ] =
          await Promise.all([
            userResponse.json(),
            materialsResponse.json(),
            analyticsResponse.json(),
            activityResponse.json(),
            usageResponse.json(),
          ])

        if (!userResponse.ok) {
          throw new Error(
            userData.message || "Unable to load your account.",
          )
        }
        if (!materialsResponse.ok) {
          throw new Error(
            materialsData.message ||
              "Unable to load your study materials.",
          )
        }
        if (!analyticsResponse.ok) {
          throw new Error(
            analyticsData.message ||
              "Unable to load your quiz progress.",
          )
        }
        if (!activityResponse.ok) {
          throw new Error(
            activityData.message || "Unable to load recent activity.",
          )
        }
        if (!usageResponse.ok) {
          throw new Error(
            usageData.message || "Unable to load your plan usage.",
          )
        }

        if (!active) return
        setError("")
        setData({
          name:
            userData.user?.name?.trim().split(/\s+/)[0] ||
            "Student",
          materials: materialsData.materials || [],
          analytics: analyticsData.analytics,
          activities: activityData.activities || [],
          usage: usageData as PlanUsageData,
        })
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load your dashboard.",
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()
    return () => {
      active = false
    }
  }, [navigate, reloadKey])

  if (loading) {
    return (
      <div className="dashboard-main workspace-dashboard">
        <div className="dashboard-page-state" role="status">
          <span className="dashboard-loading-spinner" />
          Loading your learning dashboard...
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="dashboard-main workspace-dashboard">
        <div className="dashboard-page-error" role="alert">
          <p>{error || "Unable to load your dashboard."}</p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setLoading(true)
              setReloadKey((current) => current + 1)
            }}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const { analytics, materials, activities } = data
  const recentMaterials = materials.slice(0, 3)
  const lowestMaterial =
    [...analytics.materialPerformance].sort(
      (first, second) =>
        first.averageScore - second.averageScore,
    )[0]
  const bestMaterials = [...analytics.materialPerformance]
    .sort((first, second) => second.averageScore - first.averageScore)
    .slice(0, 3)
  const needsPractice = [...analytics.materialPerformance]
    .sort((first, second) => first.averageScore - second.averageScore)
    .slice(0, 3)
  const accuracy = analytics.totalQuestions
    ? Math.round(
        (analytics.totalCorrectAnswers /
          analytics.totalQuestions) *
          100,
      )
    : 0

  return (
    <div className="dashboard-main workspace-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">STUDENT WORKSPACE</p>
          <h1>Welcome back, {data.name}.</h1>
          <p>Here is your learning activity and what to focus on next.</p>
        </div>
        <Link to="/materials" className="btn btn-primary">
          + New Study Material
        </Link>
      </header>

      <PlanUsage data={data.usage} />

      <section className="dashboard-stats" aria-label="Learning summary">
        <article>
          <span>Study Materials</span>
          <strong>{materials.length}</strong>
          <small>
            {materials.length
              ? "Available to study"
              : "Upload material to begin"}
          </small>
        </article>
        <article>
          <span>Quizzes Taken</span>
          <strong>{analytics.totalQuizzes}</strong>
          <small>
            {analytics.totalQuizzes
              ? "Saved quiz attempts"
              : "No quiz activity yet"}
          </small>
        </article>
        <article>
          <span>Average Quiz Score</span>
          <strong>
            {analytics.totalQuizzes
              ? `${Math.round(analytics.averageScore)}%`
              : "—"}
          </strong>
          <small>
            {analytics.totalQuizzes
              ? `Best score ${Math.round(analytics.bestScore)}%`
              : "Take your first quiz to track progress"}
          </small>
        </article>
        <article>
          <span>Questions Correct</span>
          <strong>
            {analytics.totalQuestions
              ? `${accuracy}%`
              : "—"}
          </strong>
          <small>
            {analytics.totalQuestions
              ? `${analytics.totalCorrectAnswers} of ${analytics.totalQuestions} answered correctly`
              : "No quiz answers recorded yet"}
          </small>
        </article>
      </section>

      <section className="dashboard-progress-summary dashboard-panel">
        <div>
          <p className="dashboard-eyebrow">STUDY PROGRESS</p>
          <h2>Your quiz accuracy</h2>
          <p>
            {analytics.totalQuestions
              ? "Based on all of your saved quiz answers."
              : "Take your first quiz to start tracking your progress."}
          </p>
        </div>
        {analytics.totalQuestions ? (
          <>
            <div
              className="dashboard-progress-meter"
              role="progressbar"
              aria-label="Quiz answer accuracy"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={accuracy}
            >
              <span style={{ width: `${accuracy}%` }} />
            </div>
            <strong className="dashboard-progress-value">
              {accuracy}% correct
            </strong>
          </>
        ) : (
          <Link to="/quizzes" className="btn btn-primary">
            Take your first quiz
          </Link>
        )}
        <div className="dashboard-progress-actions">
          <Link to="/progress" className="btn btn-secondary">
            Detailed progress
          </Link>
          <Link to="/materials" className="dashboard-text-link">
            View materials
          </Link>
        </div>
      </section>

      <section className="dashboard-topic-grid">
        <article className="dashboard-topic-panel strong-topics-panel">
          <p className="dashboard-eyebrow">BEST-PERFORMING MATERIALS</p>
          <h2>What is going well</h2>
          {bestMaterials.length ? (
            <ul className="dashboard-performance-list">
              {bestMaterials.map((material) => (
                <li key={material.materialId}>
                  <Link
                    to={`/notes?material=${material.materialId}`}
                  >
                    {material.materialTitle}
                  </Link>
                  <strong>
                    {Math.round(material.averageScore)}%
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-topic-empty">
              Quiz results will show your best-performing materials here.
            </p>
          )}
        </article>

        <article className="dashboard-topic-panel weak-topics-panel">
          <p className="dashboard-eyebrow">MATERIALS TO PRACTICE</p>
          <h2>Where to focus next</h2>
          {needsPractice.length ? (
            <ul className="dashboard-performance-list">
              {needsPractice.map((material) => (
                <li key={material.materialId}>
                  <Link
                    to={`/notes?material=${material.materialId}`}
                  >
                    {material.materialTitle}
                  </Link>
                  <strong>
                    {Math.round(material.averageScore)}%
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-topic-empty">
              Complete a quiz to see which materials could use more practice.
            </p>
          )}
        </article>
      </section>

      <section className="dashboard-recommendation dashboard-panel">
        <div>
          <p className="dashboard-eyebrow">YOUR NEXT STEP</p>
          <h2>
            {lowestMaterial
              ? `Review ${lowestMaterial.materialTitle}`
              : analytics.totalQuizzes
                ? "Keep building on your quiz progress"
                : materials.length
                  ? "Turn a material into a focused study session"
                  : "Add your first study material"}
          </h2>
          <p>
            {lowestMaterial
              ? `Your average score for this material is ${Math.round(lowestMaterial.averageScore)}%. Review its notes, then test yourself again.`
              : analytics.totalQuizzes
                ? "Review your recent results and keep practicing the material you have studied."
                : materials.length
                  ? "Generate short notes or take a quiz using one of your uploaded materials."
                  : "Upload class notes or a textbook excerpt to get started."}
          </p>
        </div>
        <Link
          className="btn btn-primary"
          to={
            lowestMaterial
              ? `/notes?material=${lowestMaterial.materialId}`
              : materials.length
                ? "/quizzes"
                : "/materials"
          }
        >
          {lowestMaterial
            ? "Review short notes"
            : materials.length
              ? "Start studying"
              : "Upload material"}
        </Link>
      </section>

      <section className="dashboard-panel dashboard-materials-panel">
        <div className="dashboard-panel-heading">
          <div>
            <p className="dashboard-eyebrow">YOUR LEARNING</p>
            <h2>Recent materials</h2>
          </div>
          <Link to="/materials" className="dashboard-text-link">
            View all materials
          </Link>
        </div>
        {recentMaterials.length ? (
          <div className="dashboard-material-list">
            {recentMaterials.map((material) => (
              <article
                className="dashboard-material-item"
                key={material._id}
              >
                <div className="dashboard-material-file">
                  <span>
                    {material.originalName
                      .split(".")
                      .pop()
                      ?.toUpperCase() || "FILE"}
                  </span>
                </div>
                <div className="dashboard-material-info">
                  <h3>{material.title}</h3>
                  <p>{material.originalName}</p>
                  <small>{formatDate(material.createdAt)}</small>
                </div>
                <div className="dashboard-material-actions">
                  <Link to={`/notes?material=${material._id}`}>
                    Short notes
                  </Link>
                  <Link to={`/flashcards?material=${material._id}`}>
                    Flashcards
                  </Link>
                  <Link to="/quizzes">Quizzes</Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-state">
            <div className="empty-state-icon">+</div>
            <h3>No study materials yet</h3>
            <p>
              Upload your first study material to create notes,
              flashcards, and quizzes from your own content.
            </p>
            <Link to="/materials" className="btn btn-primary">
              Upload material
            </Link>
          </div>
        )}
      </section>

      <section className="dashboard-panel dashboard-activity-panel">
        <div className="dashboard-panel-heading">
          <div>
            <p className="dashboard-eyebrow">RECENT ACTIVITY</p>
            <h2>Your latest study activity</h2>
          </div>
          <Link to="/study" className="dashboard-text-link">
            Start studying
          </Link>
        </div>
        {activities.length ? (
          <ul className="dashboard-activity-list">
            {activities.map((activity) => (
              <li key={activity.id}>
                <Link
                  className="dashboard-activity-item"
                  to={activity.to}
                >
                  <span className="dashboard-activity-icon" aria-hidden="true">
                    <ActivityIcon type={activity.type} />
                  </span>
                  <span className="dashboard-activity-copy">
                    <strong>{activity.description}</strong>
                    <span>{activity.title}</span>
                    <small>{formatRelativeDate(activity.timestamp)}</small>
                  </span>
                  {activity.score !== undefined && (
                    <strong className="dashboard-activity-score">
                      {Math.round(activity.score)}%
                    </strong>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="dashboard-activity-empty">
            <h3>No recent activity yet</h3>
            <p>Upload a material or start studying to see your learning activity here.</p>
            <Link to={materials.length ? "/study" : "/materials"} className="dashboard-text-link">
              {materials.length ? "Start studying" : "Add study material"}
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

export default Dashboard
