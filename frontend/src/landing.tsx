import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import Navbar from "./Navbar"
import Footer from "./Footer"
import {
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  Gift,
  Layers3,
  Smartphone,
  Sparkles,
  Target,
  CircleCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import TelegramVerification from "./TelegramVerification"

const features: [LucideIcon, string, string][] = [
  [BookOpen, "AI Study Notes", "Turn long materials into clear, organized notes."],
  [BrainCircuit, "Key Concepts", "Understand the ideas that matter most."],
  [Layers3, "Flashcards", "Review important topics with focused cards."],
  [CircleCheck, "AI Quizzes", "Practice with questions generated from your material."],
  [BarChart3, "Progress Tracking", "See what you have reviewed and what remains."],
  [Target, "Weak Topic Detection", "Identify topics that need more attention."],
  [Bot, "AI Study Tutor", "Get helpful explanations when concepts feel difficult."],
  [Smartphone, "Mobile Friendly", "Study wherever your learning takes you."],
]

const steps: [string, string, string][] = [
  ["01", "Upload Your Material", "Bring your notes, PDFs, or class content into one focused workspace."],
  ["02", "Steady Mate Understands It", "Important ideas and concepts are organized so they are easier to review."],
  ["03", "Get Notes, Concepts & Flashcards", "Turn your material into practical resources for active recall."],
  ["04", "Practice With Quizzes", "Test your understanding with focused questions from your own material."],
  ["05", "Track Progress & Review", "See where you are improving and choose what to study next."],
]


function Landing() {
  const [premiumPrice, setPremiumPrice] = useState<number | null>(null)
  const [referralPercentage, setReferralPercentage] = useState<number | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/premium/pricing`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || "Unable to load Premium pricing")
        setPremiumPrice(data.premiumPrice.amount)
        setReferralPercentage(data.referral.rewardPercentage)
      })
      .catch((error: unknown) => {
        console.error("Unable to load Premium pricing:", error)
      })
  }, [])

  return (
    <main className="landing">
      <Navbar />

      <section className="hero-section">
        <div className="hero-content">
          <p className="hero-label">
            AI STUDY COMPANION FOR ETHIOPIAN STUDENTS
          </p>

          <h1>
            Study smarter.
            <br />
            Understand better.
            <br />
            <span>Achieve more.</span>
          </h1>

          <p className="hero-description">
            Steady Mate turns your study materials into personalized notes,
            flashcards, quizzes, and learning support — helping you study with
            more focus and less confusion.
          </p>

          <div className="hero-actions">
            <Link to="/signup" className="btn btn-primary btn-large">
              Get Started
            </Link>

            <Link to="/how-it-works" className="btn btn-secondary btn-large">
              See How It Works
            </Link>
          </div>

          <p className="hero-note">
            Built for students. Designed for better learning.
          </p>
        </div>

        <div
          className="study-dashboard"
          aria-label="Conceptual Steady Mate study dashboard"
        >
          <div className="dashboard-top">
            <span className="dashboard-dot" />
            <span className="dashboard-dot" />
            <span className="dashboard-dot" />
            <span className="dashboard-title">Steady Mate workspace</span>
          </div>

          <div className="dashboard-body">
            <div className="dashboard-material">
              <small>STUDY MATERIAL</small>
              <h3>Biology — Cell Structure</h3>
              <div className="material-line" />
              <div className="material-line short" />
              <div className="material-line" />
              <div className="material-line medium" />
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-card purple">
                <small>AI NOTES</small>
                <strong>Clear study summary</strong>
              </div>

              <div className="dashboard-card blue">
                <small>FLASHCARDS</small>
                <strong>15 cards ready</strong>
              </div>

              <div className="dashboard-card dark">
                <small>QUIZ</small>
                <strong>20 questions</strong>
              </div>

              <div className="dashboard-card progress-card">
                <small>PROGRESS</small>
                <strong>78%</strong>
                <span className="progress-bar" />
              </div>
            </div>

            <div className="weak-topics">
              <small>WEAK TOPICS</small>
              <span>Cell membrane</span>
              <span>Mitochondria</span>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="section-heading">
          <p>EVERYTHING YOU NEED</p>
          <h2>Everything you need to study smarter.</h2>
        </div>

        <div className="features-grid">
          {features.map(([Icon, title, description]) => (
            <article className="feature-card" key={title}>
              <div className="feature-icon"><Icon aria-hidden="true" size={21} /></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section">
        <div className="section-heading">
          <p>HOW IT WORKS</p>
          <h2>A simpler path from material to mastery.</h2>
        </div>

        <div className="steps-container">
          {steps.map(([number, title, description]) => (
            <article className="step" key={number}>
              <span className="step-number">{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section">
        <div className="section-heading">
          <p>ACCOUNT TRUST</p>
          <h2>Study with confidence.</h2>
          <p>Verify your account through the official Steady Mate support bot.</p>
        </div>
        <TelegramVerification />
      </section>

      <section className="trust-section">
        <div className="section-heading">
          <p>PLAN OPTIONS</p>
          <h2>Study more and earn more with Steady Mate.</h2>
        </div>

        <div className="features-grid">
          <article className="feature-card">
            <div className="feature-icon">
              <Sparkles aria-hidden="true" size={21} />
            </div>
            <h3>Premium{premiumPrice ? ` for ${premiumPrice} ETB/month` : " subscription"}</h3>
            <p>Unlock higher AI usage limits, better access, and a more complete study experience.</p>
            <Link to="/premium" className="cta-link">
              View premium plan →
            </Link>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <Gift aria-hidden="true" size={21} />
            </div>
            <h3>Invite friends and earn referral rewards</h3>
            <p>
              {referralPercentage
                ? `Earn ${referralPercentage}% of each successfully approved Premium payment from a referred student.`
                : "Invite students to Steady Mate and earn when their Premium payments are approved."}
            </p>
            <Link to="/referrals" className="cta-link">
              Explore referrals →
            </Link>
          </article>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-content">
          <p className="hero-label">READY TO STUDY SMARTER?</p>
          <h2>Turn your materials into a learning system.</h2>
          <p>Personalized study support, built around the way you learn.</p>

          <Link to="/signup" className="btn btn-primary btn-large">
            Get Started
          </Link>

          <Link to="/how-it-works" className="cta-link">
            How It Works →
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}

export default Landing