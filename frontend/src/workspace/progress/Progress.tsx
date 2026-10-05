import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { BarChart3, Trophy } from "lucide-react"

import "./Progress.css"

type RecentAttempt = {
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

type QuizAnalytics = {
  totalQuizzes: number
  averageScore: number
  bestScore: number
  totalQuestions: number
  totalCorrectAnswers: number
  recentAttempts: RecentAttempt[]
  materialPerformance: MaterialPerformance[]
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

function Progress() {
  const navigate = useNavigate()
  const [analytics, setAnalytics] =
    useState<QuizAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadAnalytics() {
      const token = sessionStorage.getItem("steadymate_token")
      if (!token) {
        navigate("/login")
        return
      }

      try {
        const response = await fetch(
          `${API_URL}/api/quiz-attempts/analytics`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load quiz progress.",
          )
        }

        if (!active) return
        setError("")
        setAnalytics(data.analytics as QuizAnalytics)
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load quiz progress.",
          )
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadAnalytics()
    return () => {
      active = false
    }
  }, [navigate, reloadKey])

  if (isLoading) {
    return (
      <div className="progress-page">
        <div className="progress-state" role="status">
          <span className="progress-spinner" />
          Loading your quiz progress...
        </div>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="progress-page">
        <div className="progress-error" role="alert">
          <p>{error || "Unable to load quiz progress."}</p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setIsLoading(true)
              setReloadKey((current) => current + 1)
            }}
            disabled={isLoading}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const hasAttempts = analytics.totalQuizzes > 0
  const accuracy = analytics.totalQuestions
    ? Math.round(
        (analytics.totalCorrectAnswers /
          analytics.totalQuestions) *
          100,
      )
    : 0

  return (
    <div className="progress-page">
      <header className="progress-header">
        <div className="progress-heading-icon">
          <BarChart3 size={22} />
        </div>
        <div>
          <p className="progress-eyebrow">YOUR LEARNING DATA</p>
          <h1>Progress</h1>
          <p>Track quiz results and see how you perform across materials.</p>
        </div>
      </header>

      {hasAttempts ? (
        <>
          <section className="progress-stat-grid" aria-label="Quiz statistics">
            <article className="progress-stat-card">
              <span>Total quizzes</span>
              <strong>{analytics.totalQuizzes}</strong>
              <small>Saved attempts</small>
            </article>
            <article className="progress-stat-card">
              <span>Average score</span>
              <strong>{Math.round(analytics.averageScore)}%</strong>
              <small>Across all quiz attempts</small>
            </article>
            <article className="progress-stat-card">
              <span>Best score</span>
              <strong>{Math.round(analytics.bestScore)}%</strong>
              <small>Your highest attempt</small>
            </article>
            <article className="progress-stat-card">
              <span>Questions correct</span>
              <strong>
                {analytics.totalCorrectAnswers}
                <small> / {analytics.totalQuestions}</small>
              </strong>
              <small>{accuracy}% overall accuracy</small>
            </article>
          </section>

          <section className="progress-panel">
            <div className="progress-section-heading">
              <div>
                <p className="progress-eyebrow">RECENT RESULTS</p>
                <h2>Quiz attempts</h2>
              </div>
            </div>
            <div className="progress-attempt-list">
              {analytics.recentAttempts.map((attempt) => (
                <article
                  className="progress-attempt"
                  key={attempt._id}
                >
                  <div className="progress-attempt-icon">
                    <Trophy size={17} />
                  </div>
                  <div className="progress-attempt-info">
                    <strong>{attempt.materialTitle}</strong>
                    <span>
                      {attempt.difficulty} · {formatDate(attempt.createdAt)}
                    </span>
                  </div>
                  <div className="progress-attempt-score">
                    <strong>{Math.round(attempt.score)}%</strong>
                    <span>
                      {attempt.correctAnswers}/{attempt.totalQuestions} correct
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="progress-panel">
            <div className="progress-section-heading">
              <div>
                <p className="progress-eyebrow">BY STUDY MATERIAL</p>
                <h2>Material performance</h2>
                <p>
                  Based on your saved quiz scores for each material.
                </p>
              </div>
            </div>
            {analytics.materialPerformance.length ? (
              <div className="progress-material-list">
                {analytics.materialPerformance.map((material) => {
                  const average = Math.round(material.averageScore)
                  return (
                    <article
                      className="progress-material-row"
                      key={material.materialId}
                    >
                      <div className="progress-material-heading">
                        <div>
                          <strong>{material.materialTitle}</strong>
                          <span>
                            {material.attempts}{" "}
                            {material.attempts === 1
                              ? "attempt"
                              : "attempts"}{" "}
                            · best {Math.round(material.bestScore)}%
                          </span>
                        </div>
                        <strong>{average}%</strong>
                      </div>
                      <div
                        className="progress-score-track"
                        role="progressbar"
                        aria-label={`${material.materialTitle} average score`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={average}
                      >
                        <span
                          style={{
                            width: `${Math.max(0, Math.min(100, average))}%`,
                          }}
                        />
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="progress-empty-inline">
                Material performance will appear after quiz attempts are saved.
              </p>
            )}
          </section>

          <p className="progress-topic-note">
            Topic-level scores are not available yet. Quiz attempts currently
            record results by material, not by topic.
          </p>
        </>
      ) : (
        <section className="progress-empty">
          <div className="progress-empty-icon">
            <BarChart3 size={22} />
          </div>
          <p className="progress-eyebrow">YOUR PROGRESS STARTS HERE</p>
          <h2>No quiz activity yet</h2>
          <p>
            Take your first quiz to start tracking your scores and material
            performance.
          </p>
          <Link to="/quizzes" className="btn btn-primary">
            Take a quiz
          </Link>
        </section>
      )}
    </div>
  )
}

export default Progress
