import { useState } from "react"
import { Link } from "react-router-dom"
import { Camera, Music2, Play, Send } from "lucide-react"

const faqItems = [
  ["What is Steady Mate?", "Steady Mate is an AI study companion designed to help students turn their study materials into useful learning resources."],
  ["Who is Steady Mate for?", "Steady Mate is being built especially with Ethiopian students in mind, while keeping the vision open to students across Africa and worldwide."],
  ["How does Steady Mate work?", "You provide your study material, and Steady Mate is designed to help create notes, key concepts, flashcards, and quizzes from it."],
  ["What can I upload?", "The planned experience supports PDF files and pasted study text."],
  ["Can Steady Mate create quizzes?", "Yes. Steady Mate is designed to create practice quizzes from your study material."],
  ["Can Steady Mate create flashcards?", "Yes. Flashcards are one of the planned learning resources created from your material."],
  ["Is Steady Mate free?", "Pricing has not been finalized yet."],
  ["Can I use Steady Mate on my phone?", "Yes. The frontend is designed to be responsive and usable on mobile devices."],
  ["Does Steady Mate track my progress?", "Progress tracking is part of the planned student experience."],
]

const socials = [
  { name: "Telegram", url: "https://t.me/steadymate", icon: Send },
  { name: "YouTube", url: "https://www.youtube.com/@fiker-b3s", icon: Play },
  { name: "TikTok", url: "https://www.tiktok.com/@steadymate_", icon: Music2 },
  { name: "Instagram", url: "https://www.instagram.com/steady_mate_", icon: Camera },
]

function Footer() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <img src="/logo.png" alt="Steady Mate" />
          </Link>
          <p>Your AI Study Companion for Ethiopian Students.</p>
          <p className="footer-description">
            Turn your study materials into notes, flashcards, quizzes, and
            personalized learning support.
          </p>
        </div>

        <div className="footer-column">
          <h3>Quick Links</h3>
          <Link to="/">Home</Link>
          <Link to="/features">Features</Link>
          <Link to="/how-it-works">How It Works</Link>
          <Link to="/about">About</Link>
          <Link to="/login">Login</Link>
          <Link to="/signup">Get Started</Link>
        </div>

        <div className="footer-column">
          <h3>Resources</h3>
          <a href="#footer-faq">FAQ</a>
          <Link to="/how-it-works">Study Tips</Link>
          <a href="mailto:YOUR_EMAIL_HERE">Contact</a>
        </div>

        <div className="footer-column">
          <h3>Follow Steady Mate</h3>
          <div className="footer-socials">
            {socials.map(({ name, url, icon: Icon }) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                className="footer-social-link"
              >
                <Icon aria-hidden="true" size={18} strokeWidth={2} />
              </a>
            ))}
          </div>

          <div className="footer-contact">
            <strong>Have a question?</strong>
            <span>We&apos;d love to hear from you.</span>
          </div>
        </div>
      </div>

      <section id="footer-faq" className="footer-faq" aria-label="Frequently asked questions">
        <div className="footer-faq-heading">
          <p>FAQ</p>
          <h2>Frequently Asked Questions</h2>
          <span>Everything you need to know about Steady Mate.</span>
        </div>

        <div className="footer-faq-list">
          {faqItems.map(([question, answer], index) => {
            const isOpen = openFaq === index

            return (
              <div className="footer-faq-item" key={question}>
                <button
                  type="button"
                  className="footer-faq-question"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                >
                  <span>{question}</span>
                  <strong>{isOpen ? "−" : "+"}</strong>
                </button>

                {isOpen && <p>{answer}</p>}
              </div>
            )
          })}
        </div>
      </section>

      <div className="footer-bottom">
        <span>© 2026 Steady Mate. All rights reserved.</span>
        <span>Built for students. Designed for better learning.</span>
      </div>
    </footer>
  )
}

export default Footer