import Navbar from "./Navbar"
import Footer from "./Footer"
import BackToHome from "./BackToHome"
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  Bot,
  ChartNoAxesCombined,
  Layers3,
  Smartphone,
  Target,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const features: [LucideIcon, string, string][] = [
  [BookOpen, "AI Study Notes", "Upload your study material and get clear, short notes focused on the ideas you need to understand."],
  [BrainCircuit, "Key Concepts", "Identify the important concepts from your material so your study time stays focused."],
  [Layers3, "Flashcards", "Turn important information into focused revision cards you can review whenever you need."],
  [ChartNoAxesCombined, "AI Quizzes", "Practice with questions generated from your own study material and check what you understand."],
  [BarChart3, "Progress Tracking", "See your quiz performance and understand which topics need more attention."],
  [Target, "Weak Topic Detection", "Find the areas that need more review so you can spend your time where it matters most."],
  [Bot, "AI Study Tutor", "Ask questions about your material and get helpful explanations for difficult concepts."],
  [Smartphone, "Mobile Friendly", "Study smoothly across phones, tablets, and computers wherever learning takes you."],
]

function Features() {
  return (
    <>
      <Navbar />

      <main className="inner-page feature-page">
        <BackToHome />

        {/* Page Hero */}
        <section className="page-hero feature-page-hero">
          <p className="hero-label">STEADY MATE FEATURES</p>

          <h1>
            Everything you need
            <br />
            to <span>study smarter.</span>
          </h1>

          <p>
            Steady Mate transforms your study materials into
            useful learning tools that help you understand,
            practice, and improve.
          </p>
        </section>

        {/* Features */}
        <section className="feature-intro">
          <div>
            <p className="card-label">ONE STUDY WORKSPACE</p>
            <h2>Everything stays connected to what you are learning.</h2>
          </div>
          <p>
            Steady Mate keeps your materials, practice, and progress in one
            focused flow so every study session has a clear next step.
          </p>
        </section>

        <section className="feature-list feature-cards" aria-label="Steady Mate features">
          {features.map(([Icon, title, description], index) => (
            <article className="big-feature" key={title as string}>
              <p className="feature-index">{String(index + 1).padStart(2, "0")}</p>
              <div className="big-feature-icon"><Icon aria-hidden="true" size={24} /></div>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>

      </main>

      <Footer />
    </>
  )
}

export default Features