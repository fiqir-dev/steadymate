import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Layers3,
  RefreshCw,
  Shuffle,
  Sparkles,
  RotateCcw,
} from "lucide-react"

import AiGenerationStatus from "../AiGenerationStatus"
import "../StudyTools.css"
import "./Flashcards.css"

type Material = {
  _id: string
  title: string
}

type Flashcard = {
  index: number
  question: string
  answer: string
  known: boolean
}

type ApiData = {
  success: boolean
  message?: string
  materials?: Material[]
  flashcards?: Array<{
    question: string
    answer: string
  }>
  studyContent?: {
    flashcards: Flashcard[]
  }
}

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"
const SELECTED_MATERIAL_KEY = "steadymate_selected_material_id"

function Flashcards() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedMaterialId = searchParams.get("material")

  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedMaterialId, setSelectedMaterialId] = useState("")
  const [cards, setCards] = useState<Flashcard[]>([])
  const [cardsMaterialId, setCardsMaterialId] = useState("")
  const [currentCard, setCurrentCard] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingProgress, setSavingProgress] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const generationInFlight = useRef(false)
  const progressSaveInFlight = useRef(false)

  useEffect(() => {
    let active = true

    async function loadMaterials() {
      const token = sessionStorage.getItem("steadymate_token")
      if (!token) {
        navigate("/login")
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/materials`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = (await response.json()) as ApiData
        if (!response.ok) {
          throw new Error(data.message || "Unable to load materials.")
        }
        if (!active) return

        const loadedMaterials = data.materials || []
        setMaterials(loadedMaterials)
        const preferredId =
          requestedMaterialId ||
          sessionStorage.getItem(SELECTED_MATERIAL_KEY) ||
          ""
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
              : "Unable to load materials.",
          )
        }
      } finally {
        if (active) setLoadingMaterials(false)
      }
    }

    void loadMaterials()
    return () => {
      active = false
    }
  }, [navigate, requestedMaterialId])

  useEffect(() => {
    if (!selectedMaterialId) return

    let active = true
    const token = sessionStorage.getItem("steadymate_token")

    async function loadSavedCards() {
      if (!token) {
        navigate("/login")
        return
      }

      try {
        const response = await fetch(
          `${API_URL}/api/study-content/${selectedMaterialId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        const data = (await response.json()) as ApiData
        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load saved flashcards.",
          )
        }
        if (active) {
          setCards(data.studyContent?.flashcards || [])
          setCardsMaterialId(selectedMaterialId)
          setCurrentCard(0)
          setShowAnswer(false)
          setError("")
        }
      } catch (loadError) {
        if (active) {
          setCardsMaterialId(selectedMaterialId)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load saved flashcards.",
          )
        }
      }
    }

    void loadSavedCards()
    return () => {
      active = false
    }
  }, [navigate, selectedMaterialId])

  async function generateCards() {
    if (
      !selectedMaterialId ||
      generationInFlight.current
    ) {
      return
    }

    const token = sessionStorage.getItem("steadymate_token")
    if (!token) {
      navigate("/login")
      return
    }
    const material = materials.find(
      (item) => item._id === selectedMaterialId,
    )
    if (!material) return

    generationInFlight.current = true
    setGenerating(true)
    setError("")
    setSuccess("")

    try {
      const generationResponse = await fetch(
        `${API_URL}/api/ai-tutor/flashcards`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            materialId: selectedMaterialId,
            subject: material.title,
          }),
        },
      )
      const generationData =
        (await generationResponse.json()) as ApiData
      if (!generationResponse.ok || !generationData.flashcards) {
        throw new Error(
          generationData.message || "Unable to generate flashcards.",
        )
      }

      const saveResponse = await fetch(
        `${API_URL}/api/study-content/${selectedMaterialId}/flashcards`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            flashcards: generationData.flashcards,
          }),
        },
      )
      const saveData = (await saveResponse.json()) as ApiData
      if (!saveResponse.ok) {
        throw new Error(
          saveData.message ||
            "Flashcards were generated but could not be saved.",
        )
      }

      setCards(saveData.studyContent?.flashcards || [])
      setCardsMaterialId(selectedMaterialId)
      setCurrentCard(0)
      setShowAnswer(false)
      setSuccess(`Flashcards saved for ${material.title}.`)
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate flashcards.",
      )
    } finally {
      generationInFlight.current = false
      setGenerating(false)
    }
  }

  async function updateCardStatus(known: boolean) {
    const card = cards[currentCard]
    const token = sessionStorage.getItem("steadymate_token")
    if (
      !card ||
      !token ||
      progressSaveInFlight.current
    ) {
      if (!token) navigate("/login")
      return
    }

    progressSaveInFlight.current = true
    setSavingProgress(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(
        `${API_URL}/api/study-content/${selectedMaterialId}/flashcards/${card.index}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ known }),
        },
      )
      const data = (await response.json()) as ApiData
      if (!response.ok) {
        throw new Error(
          data.message || "Unable to save card progress.",
        )
      }

      const savedCards = data.studyContent?.flashcards || []
      setCards((previous) =>
        previous.map(
          (previousCard) =>
            savedCards.find(
              (savedCard) => savedCard.index === previousCard.index,
            ) || previousCard,
        ),
      )
      setSuccess(
        known
          ? "Marked as known."
          : "Added to your review cards.",
      )
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save card progress.",
      )
    } finally {
      progressSaveInFlight.current = false
      setSavingProgress(false)
    }
  }

  function shuffleCards() {
    const shuffled = [...cards]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index],
      ]
    }
    setCards(shuffled)
    setCurrentCard(0)
    setShowAnswer(false)
  }

  function restartReview() {
    setCurrentCard(0)
    setShowAnswer(false)
    setError("")
    setSuccess("")
  }

  const selectedMaterial = materials.find(
    (material) => material._id === selectedMaterialId,
  )
  const cardsAreLoading =
    Boolean(selectedMaterialId) &&
    cardsMaterialId !== selectedMaterialId
  const visibleCards =
    cardsMaterialId === selectedMaterialId ? cards : []
  const card = visibleCards[currentCard]
  const knownCount = visibleCards.filter((item) => item.known).length

  return (
    <div className="flashcards-page workspace-study-tool">
      <header className="study-tool-header">
        <div className="study-tool-icon"><Layers3 size={22} /></div>
        <div>
          <p className="study-tool-eyebrow">ACTIVE RECALL</p>
          <h1>Flashcards</h1>
          <p>Study AI-generated cards and save what you know for next time.</p>
        </div>
      </header>

      {error && <div className="study-tool-error" role="alert">{error}</div>}
      {success && <div className="study-tool-success" role="status">{success}</div>}

      <section className="study-tool-card flashcards-controls">
        <label htmlFor="flashcards-material">Study material</label>
        {loadingMaterials ? (
          <div className="study-tool-loading">Loading your materials...</div>
        ) : materials.length ? (
          <div className="study-tool-controls-row">
            <select
              id="flashcards-material"
              value={selectedMaterialId}
              disabled={generating || savingProgress || cardsAreLoading}
              onChange={(event) => {
                const nextId = event.target.value
                setSelectedMaterialId(nextId)
                setCards([])
                setCardsMaterialId("")
                setCurrentCard(0)
                setShowAnswer(false)
                sessionStorage.setItem(SELECTED_MATERIAL_KEY, nextId)
                setSuccess("")
              }}
            >
              {materials.map((material) => (
                <option key={material._id} value={material._id}>
                  {material.title}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              type="button"
              disabled={generating || cardsAreLoading || savingProgress}
              onClick={() => void generateCards()}
            >
              {generating ? (
                <RefreshCw className="study-tool-spinner" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {generating
                ? "Generating and saving..."
                : cards.length
                  ? "Regenerate flashcards"
                  : "Generate flashcards"}
            </button>
          </div>
        ) : (
          <div className="study-tool-empty-inline">
            <p>Upload a study material to create flashcards from it.</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate("/materials")}
            >
              Upload material
            </button>
          </div>
        )}
        {selectedMaterial && (
          <p className="study-tool-selected">
            Cards for <strong>{selectedMaterial.title}</strong>
          </p>
        )}
      </section>

      {generating ? (
        <AiGenerationStatus
          title="Generating your flashcards"
          description="Finding key ideas and turning them into review cards."
          detail={selectedMaterial?.title}
        />
      ) : cardsAreLoading ? (
        <div className="study-tool-loading study-tool-content-loading" role="status">
          Loading your saved flashcards...
        </div>
      ) : card ? (
        <section className="flashcards-study">
          <div className="flashcards-progress-row">
            <span>
              Card {currentCard + 1} of {visibleCards.length}
            </span>
            <span>
              {knownCount} known · {visibleCards.length - knownCount} to review
            </span>
          </div>
          <div
            className="flashcards-progress-track"
            role="progressbar"
            aria-label="Flashcard review progress"
            aria-valuemin={0}
            aria-valuemax={visibleCards.length}
            aria-valuenow={currentCard + 1}
          >
            <span
              style={{
                width: `${((currentCard + 1) / visibleCards.length) * 100}%`,
              }}
            />
          </div>

          <button
            className={`study-tool-card flashcard-card ${
              showAnswer ? "is-flipped" : ""
            }`}
            type="button"
            onClick={() => setShowAnswer((shown) => !shown)}
            aria-label={
              showAnswer
                ? "Show flashcard question"
                : "Reveal flashcard answer"
            }
          >
            <span className="flashcard-face-label">
              {showAnswer ? "ANSWER" : "QUESTION"}
            </span>
            <strong>{showAnswer ? card.answer : card.question}</strong>
            <span className="flashcard-tap-hint">
              {showAnswer ? "Tap to see question" : "Tap to reveal answer"}
            </span>
          </button>

          <div className="flashcards-actions">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={restartReview}
              disabled={savingProgress}
            >
              <RotateCcw size={16} />
              Restart review
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={shuffleCards}
              disabled={savingProgress || visibleCards.length < 2}
            >
              <Shuffle size={16} />
              Shuffle
            </button>
          </div>

          <div className="flashcards-answer-actions">
            <button
              className="btn btn-secondary flashcard-needs-review"
              type="button"
              onClick={() => void updateCardStatus(false)}
              disabled={savingProgress}
            >
              Needs review
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void updateCardStatus(true)}
              disabled={savingProgress}
            >
              <Check size={17} />
              {savingProgress ? "Saving..." : "I know this"}
            </button>
          </div>

          <div className="flashcards-navigation">
            <button
              className="btn btn-secondary"
              type="button"
              disabled={currentCard === 0 || savingProgress}
              onClick={() => {
                setCurrentCard((index) => index - 1)
                setShowAnswer(false)
                setSuccess("")
              }}
            >
              <ChevronLeft size={17} /> Previous
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={currentCard === visibleCards.length - 1 || savingProgress}
              onClick={() => {
                setCurrentCard((index) => index + 1)
                setShowAnswer(false)
                setSuccess("")
              }}
            >
              Next <ChevronRight size={17} />
            </button>
          </div>
        </section>
      ) : materials.length > 0 && !error ? (
        <section className="study-tool-card study-tool-empty">
          <div className="study-tool-empty-icon"><Layers3 size={22} /></div>
          <h2>No flashcards for this material yet</h2>
          <p>Generate a real deck from the selected study material to begin reviewing.</p>
        </section>
      ) : null}
    </div>
  )
}

export default Flashcards
