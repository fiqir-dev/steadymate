import Navbar from "./Navbar"
import Footer from "./Footer"
import BackToHome from "./BackToHome"
import { BarChart3, BrainCircuit, FileUp, Layers3 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import TelegramVerification from "./TelegramVerification"

const steps: [LucideIcon, string, string][] = [
  [FileUp, "Upload Your Material", "Start with notes, PDFs, or pasted class content in one place."],
  [BrainCircuit, "Generate Study Resources", "Create notes and flashcards from the material you are studying."],
  [Layers3, "Practice With AI", "Review, ask questions, and test your understanding with quizzes."],
  [BarChart3, "Verify & Keep Learning", "Connect your Steady Mate account with our official Telegram bot for account verification."],
]

function HowItWorks() {
  return (
    <>
      <Navbar />

      <main className="inner-page how-page">
        <BackToHome />
        <section className="page-hero process-page-hero">
          <p className="hero-label">HOW IT WORKS</p>

          <h1>
            A simple learning flow
            <br />
            built for <span>better results.</span>
          </h1>

          <p>
            Steady Mate helps turn your study material into a structured learning experience
            that is easier to review, practice, and improve from.
          </p>
        </section>

        <section className="process-intro">
          <p className="card-label">A SIMPLE RHYTHM</p>
          <h2>From your first upload to a clearer next session.</h2>
          <p>
            Each step is designed to reduce the friction between having study
            material and knowing how to use it.
          </p>
        </section>

        <section className="feature-list process-list" aria-label="How Steady Mate works">
          {steps.map(([Icon, title, description], index) => (
            <article className="big-feature process-step" key={title as string}>
              <div className="process-step-number">0{index + 1}</div>
              <div className="big-feature-icon"><Icon aria-hidden="true" size={24} /></div>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>
        <section className="trust-section">
          <TelegramVerification />
        </section>
      </main>

      <Footer />
    </>
  )
}

export default HowItWorks