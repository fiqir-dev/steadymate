import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  BookOpen,
  Brain,
  CheckSquare,
  Clock3,
  FileText,
  Layers3,
  Play,
  Sparkles,
} from "lucide-react"

import "./Study.css"

type Material = {
  _id: string
  title: string
  originalName: string
  mimeType: string
  createdAt: string
}

type Activity = {
  id: string
  type: string
  description: string
  title: string
  timestamp: string
  materialId?: string
  to: string
}

type StudyMaterialContent = {
  _id: string
  title: string
  originalName: string
  content?: string
}

type ApiResponse = {
  success?: boolean
  message?: string
  materials?: Material[]
  activities?: Activity[]
  material?: StudyMaterialContent
}

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"
const SELECTED_MATERIAL_KEY = "steadymate_selected_material_id"

const studyTools = [
  {
    title: "Short Notes",
    description: "Review the important ideas and definitions.",
    to: "/notes",
    icon: FileText,
  },
  {
    title: "Flashcards",
    description: "Practice recall with question-and-answer cards.",
    to: "/flashcards",
    icon: Layers3,
  },
  {
    title: "AI Tutor",
    description: "Ask questions and work through tricky concepts.",
    to: "/ai-tutor",
    icon: Brain,
  },
  {
    title: "Quiz",
    description: "Check how well you understand the material.",
    to: "/quizzes",
    icon: CheckSquare,
  },
]

function materialType(material: Material) {
  const dotIndex = material.originalName.lastIndexOf(".")
  const extension =
    dotIndex > 0 ? material.originalName.slice(dotIndex + 1).toUpperCase() : ""
  const mimeType = material.mimeType.split("/").pop()?.toUpperCase()
  return extension || mimeType || "STUDY MATERIAL"
}

function formatDate(date: string) {
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(parsed)
}

function Study() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedMaterialId = searchParams.get("material")
  const [materials, setMaterials] = useState<Material[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [selectedMaterialId, setSelectedMaterialId] = useState("")
  const [materialContent, setMaterialContent] =
    useState<StudyMaterialContent | null>(null)
  const [loadingMaterialContent, setLoadingMaterialContent] = useState(false)
  const [readerError, setReaderError] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function loadStudyHub() {
      const token = sessionStorage.getItem("steadymate_token")
      if (!token) {
        navigate("/login")
        return
      }

      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [materialsResponse, activityResponse] = await Promise.all([
          fetch(`${API_URL}/api/materials`, { headers }),
          fetch(`${API_URL}/api/quiz-attempts/activity`, { headers }),
        ])
        const [materialsData, activityData] = (await Promise.all([
          materialsResponse.json(),
          activityResponse.json(),
        ])) as [ApiResponse, ApiResponse]

        if (!materialsResponse.ok) {
          throw new Error(materialsData.message || "Unable to load materials.")
        }
        if (!activityResponse.ok) {
          throw new Error(activityData.message || "Unable to load study activity.")
        }
        if (!active) return

        const loadedMaterials = materialsData.materials || []
        setMaterials(loadedMaterials)
        setActivities(activityData.activities || [])

        const savedId = sessionStorage.getItem(SELECTED_MATERIAL_KEY) || ""
        const preferredId = requestedMaterialId || savedId
        const selectedId = loadedMaterials.some(
          (material) => material._id === preferredId,
        )
          ? preferredId
          : loadedMaterials[0]?._id || ""

        setSelectedMaterialId(selectedId)
        if (selectedId) {
          sessionStorage.setItem(SELECTED_MATERIAL_KEY, selectedId)
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your study session.",
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadStudyHub()
    return () => {
      active = false
    }
  }, [navigate, requestedMaterialId])

  const selectedMaterial = materials.find(
    (material) => material._id === selectedMaterialId,
  )
  const materialActivity = useMemo(
    () =>
      activities
        .filter(
          (activity) =>
            activity.materialId === selectedMaterialId &&
            activity.type !== "material-uploaded",
        )
        .sort(
          (first, second) =>
            new Date(second.timestamp).getTime() -
            new Date(first.timestamp).getTime(),
        ),
    [activities, selectedMaterialId],
  )
  const lastActivity = materialActivity[0]

  function chooseMaterial(materialId: string) {
    setSelectedMaterialId(materialId)
    sessionStorage.setItem(SELECTED_MATERIAL_KEY, materialId)
    setMaterialContent(null)
    setReaderError("")
  }

  function rememberSelectedMaterial() {
    if (selectedMaterialId) {
      sessionStorage.setItem(SELECTED_MATERIAL_KEY, selectedMaterialId)
    }
  }

  async function readMaterial() {
    if (!selectedMaterialId || loadingMaterialContent) return
    if (materialContent?._id === selectedMaterialId) {
      setMaterialContent(null)
      setReaderError("")
      return
    }

    const token = sessionStorage.getItem("steadymate_token")
    if (!token) {
      navigate("/login")
      return
    }

    setLoadingMaterialContent(true)
    setReaderError("")
    try {
      const response = await fetch(
        `${API_URL}/api/materials/${selectedMaterialId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const data = (await response.json()) as ApiResponse
      if (!response.ok || !data.material) {
        throw new Error(data.message || "Unable to open this material.")
      }
      setMaterialContent(data.material)
    } catch (requestError) {
      setReaderError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to open this material.",
      )
    } finally {
      setLoadingMaterialContent(false)
    }
  }

  function continueRoute() {
    if (!selectedMaterialId) return "/materials"
    if (lastActivity?.type === "flashcards-generated" ||
        lastActivity?.type === "flashcards-studied") {
      return `/flashcards?material=${selectedMaterialId}`
    }
    if (lastActivity?.type === "quiz-completed") {
      return `/quizzes?material=${selectedMaterialId}`
    }
    if (lastActivity?.type === "notes-generated") {
      return `/notes?material=${selectedMaterialId}`
    }
    return `/notes?material=${selectedMaterialId}`
  }

  if (loading) {
    return (
      <div className="study-hub">
        <div className="study-hub-state" role="status">
          <span className="study-hub-spinner" />
          Loading your study materials...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="study-hub">
        <div className="study-hub-state study-hub-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(0)}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!materials.length) {
    return (
      <div className="study-hub">
        <header className="study-hub-header">
          <p className="study-hub-eyebrow">YOUR STUDY SESSION</p>
          <h1>Study</h1>
          <p>Choose a material to decide what you want to study next.</p>
        </header>
        <section className="study-hub-empty">
          <div className="study-hub-empty-icon"><BookOpen size={25} /></div>
          <h2>No study materials yet</h2>
          <p>Add class notes or a textbook excerpt to start a focused study session.</p>
          <Link to="/materials" className="btn btn-primary">Go to Materials</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="study-hub">
      <header className="study-hub-header">
        <p className="study-hub-eyebrow">YOUR STUDY SESSION</p>
        <h1>What are you studying now?</h1>
        <p>Choose a material, then pick the learning tool that fits your next step.</p>
      </header>

      <div className="study-hub-layout">
        <section className="study-material-picker" aria-labelledby="study-materials-heading">
          <div className="study-hub-panel-heading">
            <div>
              <p className="study-hub-eyebrow">YOUR LIBRARY</p>
              <h2 id="study-materials-heading">Study materials</h2>
            </div>
            <span>{materials.length} {materials.length === 1 ? "material" : "materials"}</span>
          </div>
          <div className="study-material-list">
            {materials.map((material) => (
              <button
                className={`study-material-choice ${
                  selectedMaterialId === material._id ? "selected" : ""
                }`}
                type="button"
                key={material._id}
                aria-pressed={selectedMaterialId === material._id}
                onClick={() => chooseMaterial(material._id)}
              >
                <span className="study-material-choice-icon"><FileText size={18} /></span>
                <span className="study-material-choice-copy">
                  <strong>{material.title}</strong>
                  <small>{materialType(material)} · Added {formatDate(material.createdAt)}</small>
                </span>
              </button>
            ))}
          </div>
          <Link to="/materials" className="study-hub-add-material">
            Manage study materials
          </Link>
        </section>

        {selectedMaterial && (
          <section className="study-session-card" aria-labelledby="selected-material-title">
            <div className="study-session-card-top">
              <div className="study-session-icon"><BookOpen size={21} /></div>
              <span className={`study-session-status ${lastActivity ? "in-progress" : ""}`}>
                {lastActivity ? "In progress" : "Not started"}
              </span>
            </div>
            <p className="study-hub-eyebrow">SELECTED MATERIAL</p>
            <h2 id="selected-material-title">{selectedMaterial.title}</h2>
            <dl className="study-session-meta">
              <div><dt>Type</dt><dd>{materialType(selectedMaterial)}</dd></div>
              <div><dt>Added</dt><dd>{formatDate(selectedMaterial.createdAt)}</dd></div>
              <div>
                <dt>Last activity</dt>
                <dd>
                  {lastActivity
                    ? `${lastActivity.description} · ${formatDate(lastActivity.timestamp)}`
                    : "No study activity recorded"}
                </dd>
              </div>
            </dl>
            <Link
              to={continueRoute()}
              className="btn btn-primary study-continue-button"
              onClick={rememberSelectedMaterial}
            >
              <Play size={16} fill="currentColor" /> Continue studying
            </Link>
            <button
              type="button"
              className="study-review-link"
              onClick={() => void readMaterial()}
              disabled={loadingMaterialContent}
            >
              <BookOpen size={16} />
              {loadingMaterialContent
                ? "Opening material..."
                : materialContent?._id === selectedMaterialId
                  ? "Close material"
                  : "Read / review material"}
            </button>
          </section>
        )}
      </div>

      {readerError && (
        <div className="study-material-reader-error" role="alert">
          {readerError}
        </div>
      )}
      {materialContent?._id === selectedMaterialId && (
        <section
          className="study-material-reader"
          aria-labelledby="study-reader-title"
        >
          <div className="study-hub-panel-heading">
            <div>
              <p className="study-hub-eyebrow">MATERIAL REVIEW</p>
              <h2 id="study-reader-title">{materialContent.title}</h2>
            </div>
            <button
              className="study-reader-close"
              type="button"
              onClick={() => setMaterialContent(null)}
            >
              Close
            </button>
          </div>
          {materialContent.content?.trim() ? (
            <div className="study-material-reader-content">
              {materialContent.content}
            </div>
          ) : (
            <p className="study-material-reader-empty" role="status">
              No readable text was extracted from this upload. You can still
              use the available study tools with this material.
            </p>
          )}
        </section>
      )}

      {selectedMaterial && (
        <section className="study-tools-section" aria-labelledby="study-tools-heading">
          <div className="study-hub-panel-heading">
            <div>
              <p className="study-hub-eyebrow">LEARNING TOOLS</p>
              <h2 id="study-tools-heading">Choose how to study</h2>
            </div>
            <span><Clock3 size={15} /> Pick up where you left off</span>
          </div>
          <div className="study-tool-grid">
            {studyTools.map(({ title, description, to, icon: Icon }) => (
              <Link
                className="study-tool-option"
                to={`${to}?material=${selectedMaterialId}`}
                key={title}
                onClick={rememberSelectedMaterial}
              >
                <span className="study-tool-option-icon"><Icon size={19} /></span>
                <span className="study-tool-option-copy">
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <Sparkles size={15} className="study-tool-option-arrow" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default Study
