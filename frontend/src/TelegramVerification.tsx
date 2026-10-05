import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2, Send, ShieldCheck } from "lucide-react"

import "./TelegramVerification.css"

type TelegramStatusResponse = {
  success?: boolean
  message?: string
  telegramVerified?: boolean
  telegramUrl?: string
  expiresAt?: string
}

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"

function TelegramVerification() {
  const navigate = useNavigate()
  const [verified, setVerified] = useState(false)
  const [checking, setChecking] = useState(
    () => Boolean(sessionStorage.getItem("steadymate_token")),
  )
  const [requesting, setRequesting] = useState(false)
  const [telegramUrl, setTelegramUrl] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) return

    fetch(`${API_URL}/api/telegram/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = (await response.json()) as TelegramStatusResponse
        if (!response.ok) {
          throw new Error(data.message || "Unable to check verification status.")
        }
        if (active) setVerified(data.telegramVerified === true)
      })
      .catch((statusError: unknown) => {
        if (active) {
          setError(
            statusError instanceof Error
              ? statusError.message
              : "Unable to check verification status.",
          )
        }
      })
      .finally(() => {
        if (active) setChecking(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!telegramUrl || verified) return
    let active = true
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) return

    const checkStatus = async () => {
      const expirationTime = new Date(expiresAt).getTime()
      if (Number.isFinite(expirationTime) && Date.now() >= expirationTime) {
        setTelegramUrl("")
        setNotice("This verification link expired. Request a new one to continue.")
        return
      }
      try {
        const response = await fetch(`${API_URL}/api/telegram/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = (await response.json()) as TelegramStatusResponse
        if (!response.ok) {
          throw new Error(data.message || "Unable to check verification status.")
        }
        if (!active) return
        if (data.telegramVerified) {
          setVerified(true)
          setNotice("Your Telegram verification is complete.")
          setTelegramUrl("")
        } else {
          timerRef.current = window.setTimeout(checkStatus, 2500)
        }
      } catch (statusError) {
        if (!active) return
        setError(
          statusError instanceof Error
            ? statusError.message
            : "Unable to check verification status.",
        )
        timerRef.current = window.setTimeout(checkStatus, 5000)
      }
    }

    timerRef.current = window.setTimeout(checkStatus, 2500)
    return () => {
      active = false
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [telegramUrl, verified, expiresAt])

  async function beginVerification() {
    const token = sessionStorage.getItem("steadymate_token")
    setError("")
    setNotice("")
    if (!token) {
      navigate("/login")
      return
    }
    if (requesting) return

    setRequesting(true)
    try {
      const response = await fetch(`${API_URL}/api/telegram/verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = (await response.json()) as TelegramStatusResponse
      if (!response.ok) {
        throw new Error(data.message || "Unable to start Telegram verification.")
      }
      if (data.telegramVerified) {
        setVerified(true)
        setNotice("Your Telegram account is already verified.")
        return
      }
      setTelegramUrl(data.telegramUrl || "")
      setExpiresAt(data.expiresAt || "")
      setNotice(
        "Open the official bot and start it with your one-time verification link. This page updates after the bot confirms you.",
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to start Telegram verification.",
      )
    } finally {
      setRequesting(false)
    }
  }

  return (
    <section className="telegram-verification" aria-labelledby="telegram-verification-title">
      <div className="telegram-verification-icon">
        {verified ? <CheckCircle2 size={21} /> : <ShieldCheck size={21} />}
      </div>
      <div className="telegram-verification-copy">
        <p className="telegram-verification-eyebrow">ACCOUNT VERIFICATION</p>
        <h2 id="telegram-verification-title">
          {verified ? "Telegram verified" : "Study with confidence."}
        </h2>
        <p>
          Verify your Steady Mate account through our official Telegram support bot.
        </p>
        <a
          className="telegram-verification-username"
          href="https://t.me/steadymatesupport_bot"
          target="_blank"
          rel="noopener noreferrer"
        >
          @steadymatesupport_bot
        </a>
        {notice && <p className="telegram-verification-notice" role="status">{notice}</p>}
        {telegramUrl && !verified && (
          <div className="telegram-verification-link-area">
            <a
              className="btn btn-secondary"
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send size={16} /> Open Telegram bot
            </a>
            {expiresAt && (
              <small>
                Link expires at {new Date(expiresAt).toLocaleTimeString()}.
              </small>
            )}
          </div>
        )}
        {error && <p className="telegram-verification-error" role="alert">{error}</p>}
      </div>
      <div className="telegram-verification-actions">
        {verified ? (
          <span className="telegram-verified-badge">
            <CheckCircle2 size={16} /> Verified
          </span>
        ) : (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void beginVerification()}
            disabled={checking || requesting}
          >
            {requesting
              ? "Preparing..."
              : telegramUrl
                ? "Create a new link"
                : "Verify with Telegram"}
          </button>
        )}
      </div>
    </section>
  )
}

export default TelegramVerification
