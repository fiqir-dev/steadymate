import { useEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  BookOpen,
  Eraser,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react"

import AiGenerationStatus from "../AiGenerationStatus"
import "../StudyTools.css"
import "./AiTutor.css"

type Material = {
  _id: string
  title: string
}

type TutorMessage = {
  role: "user" | "assistant"
  content: string
  welcome?: boolean
}

type ApiResponse = {
  success?: boolean
  message?: string
  code?: string
  feature?: string
  materials?: Material[]
  reply?: string
}

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"
const starterPrompts = [
  "Explain this topic simply",
  "Give me an example",
  "Quiz me on this material",
  "What should I remember for an exam?",
]

function AiTutor() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedMaterialId = searchParams.get("material")
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialId, setMaterialId] = useState("")
  const [messages, setMessages] = useState<TutorMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I’m your Steady Mate tutor. Ask me about a topic, or choose a study material so I can tailor my help to it.",
      welcome: true,
    },
  ])
  const [draft, setDraft] = useState("")
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [replying, setReplying] = useState(false)
  const [error, setError] = useState("")
  const [limitReached, setLimitReached] = useState(false)
  const sendInFlight = useRef(false)
  const endOfConversation = useRef<HTMLDivElement>(null)

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
        const data = (await response.json()) as ApiResponse
        if (!response.ok) {
          throw new Error(data.message || "Unable to load materials.")
        }
        if (!active) return

        const loaded = data.materials || []
        setMaterials(loaded)
        const savedMaterial =
          requestedMaterialId ||
          sessionStorage.getItem("steadymate_selected_material_id") ||
          ""
        if (loaded.some((material) => material._id === savedMaterial)) {
          setMaterialId(savedMaterial)
          sessionStorage.setItem("steadymate_selected_material_id", savedMaterial)
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load study materials.",
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
    endOfConversation.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    })
  }, [messages, replying])

  async function sendMessage(content: string) {
    const message = content.trim()
    if (!message || sendInFlight.current) return

    const token = sessionStorage.getItem("steadymate_token")
    if (!token) {
      navigate("/login")
      return
    }

    const history = messages
      .filter((item) => !item.welcome)
      .map(({ role, content: messageContent }) => ({
        role,
        content: messageContent,
      }))
      .slice(-12)
    const nextUserMessage: TutorMessage = {
      role: "user",
      content: message,
    }

    sendInFlight.current = true
    setMessages((previous) => [...previous, nextUserMessage])
    setDraft("")
    setError("")
    setLimitReached(false)
    setReplying(true)

    try {
      const response = await fetch(`${API_URL}/api/ai-tutor/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          materialId: materialId || undefined,
          history,
        }),
      })
      const data = (await response.json()) as ApiResponse

      if (!response.ok || !data.reply) {
        if (response.status === 429 && data.code === "LIMIT_REACHED") {
          setMessages((previous) => previous.slice(0, -1))
          setDraft(message)
          setLimitReached(data.feature === "aiTutor")
          setError(
            data.message ||
              "You've reached today's Free AI Tutor limit. Upgrade to Premium for up to 1,000 AI Tutor messages per month.",
          )
          return
        }
        throw new Error(data.message || "The tutor could not respond.")
      }

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.reply as string },
      ])
    } catch (requestError) {
      setDraft(message)
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reach the tutor. Please try again.",
      )
    } finally {
      sendInFlight.current = false
      setReplying(false)
    }
  }

  function clearConversation() {
    if (sendInFlight.current) return
    setMessages([
      {
        role: "assistant",
        content:
          "Hi! I’m your Steady Mate tutor. Ask me about a topic, or choose a study material so I can tailor my help to it.",
        welcome: true,
      },
    ])
    setDraft("")
    setError("")
    setLimitReached(false)
  }

  function handleInputKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(draft)
    }
  }

  return (
    <div className="ai-tutor-page">
      <header className="tutor-header">
        <div className="tutor-header-icon">
          <MessageCircle size={22} />
        </div>
        <div>
          <p className="tutor-eyebrow">YOUR STUDY COMPANION</p>
          <h1>AI Tutor</h1>
          <p>Ask questions and work through ideas at your own pace.</p>
        </div>
      </header>

      <section className="tutor-panel">
        <div className="tutor-toolbar">
          <label htmlFor="tutor-material">
            <BookOpen size={16} />
            Study material
          </label>
          <select
            id="tutor-material"
            value={materialId}
            disabled={loadingMaterials || replying}
            onChange={(event) => {
              const nextId = event.target.value
              setMaterialId(nextId)
              if (nextId) {
                sessionStorage.setItem(
                  "steadymate_selected_material_id",
                  nextId,
                )
              } else {
                sessionStorage.removeItem(
                  "steadymate_selected_material_id",
                )
              }
            }}
          >
            <option value="">
              {loadingMaterials
                ? "Loading materials..."
                : "Ask without a selected material"}
            </option>
            {materials.map((material) => (
              <option key={material._id} value={material._id}>
                {material.title}
              </option>
            ))}
          </select>
          <button
            className="tutor-clear-button"
            type="button"
            onClick={clearConversation}
            disabled={replying || messages.length === 1}
          >
            <Eraser size={15} />
            Clear conversation
          </button>
        </div>

        {error && (
          <div className="study-tool-error tutor-error" role="alert">
            {error}
            {limitReached && (
              <Link className="tutor-limit-upgrade" to="/premium">
                Upgrade to Premium
              </Link>
            )}
          </div>
        )}

        <div
          className="tutor-conversation"
          role="log"
          aria-label="Tutor conversation"
          aria-live="polite"
        >
          {messages.length === 1 && (
            <div className="tutor-starters">
              <div className="tutor-starters-heading">
                <Sparkles size={16} />
                <span>Try asking</span>
              </div>
              <div className="tutor-starter-list">
                {starterPrompts.map((prompt) => (
                  <button
                    type="button"
                    key={prompt}
                    disabled={replying}
                    onClick={() => void sendMessage(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <article
              className={`tutor-message tutor-message-${message.role}`}
              key={`${index}-${message.role}`}
            >
              <div className="tutor-message-avatar">
                {message.role === "assistant" ? (
                  <Sparkles size={15} />
                ) : (
                  "You"
                )}
              </div>
              <div className="tutor-message-content">
                <span>
                  {message.role === "assistant"
                    ? "Steady Mate"
                    : "You"}
                </span>
                <p>{message.content}</p>
              </div>
            </article>
          ))}

          {replying && (
            <AiGenerationStatus
              compact
              title="Your tutor is thinking..."
              description="Preparing a helpful response to your question."
            />
          )}
          <div ref={endOfConversation} />
        </div>

        <form
          className="tutor-composer"
          onSubmit={(event) => {
            event.preventDefault()
            void sendMessage(draft)
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask a question about what you're studying..."
            rows={2}
            disabled={replying}
            aria-label="Message your AI tutor"
          />
          <div className="tutor-composer-footer">
            <span>Enter to send · Shift + Enter for a new line</span>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={replying || !draft.trim()}
            >
              <Send size={16} />
              {replying ? "Waiting..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default AiTutor
