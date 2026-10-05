import Navbar from "./Navbar"
import Footer from "./Footer"
import BackToHome from "./BackToHome"

function FAQ() {
  return (
    <>
      <Navbar />

      <main className="inner-page">
        <BackToHome />

        {/* Page Hero */}
        <section className="page-hero">
          <p className="hero-label">
            FREQUENTLY ASKED QUESTIONS
          </p>

          <h1>
            Questions?
            <br />
            We've got <span>answers.</span>
          </h1>

          <p>
            Learn more about Steady Mate and how it can
            help you study smarter.
          </p>
        </section>

        {/* FAQ */}
        <section className="faq-list">

          <div className="faq-item">
            <h2>What is Steady Mate?</h2>
            <p>
              Steady Mate is an AI-powered study companion
              that turns your study materials into notes,
              flashcards, quizzes, and personalized learning
              support.
            </p>
          </div>

          <div className="faq-item">
            <h2>Who is Steady Mate for?</h2>
            <p>
              Steady Mate is designed for students, especially
              high-school and university students who want a
              simpler and more organized way to study.
            </p>
          </div>

          <div className="faq-item">
            <h2>How does Steady Mate work?</h2>
            <p>
              Upload your study material or paste your text.
              Steady Mate analyzes it and creates useful study
              resources such as notes, flashcards, and quizzes.
            </p>
          </div>

          <div className="faq-item">
            <h2>What can I upload?</h2>
            <p>
              Steady Mate is designed to support study materials
              such as PDF documents and pasted text.
            </p>
          </div>

          <div className="faq-item">
            <h2>Can Steady Mate create quizzes?</h2>
            <p>
              Yes. Steady Mate can generate practice questions
              from your study material and help you understand
              your performance.
            </p>
          </div>

          <div className="faq-item">
            <h2>Can Steady Mate create flashcards?</h2>
            <p>
              Yes. Steady Mate can turn important concepts from
              your study material into AI-generated flashcards
              for easier review.
            </p>
          </div>

          <div className="faq-item">
            <h2>Is Steady Mate free?</h2>
            <p>
              Steady Mate will start with a free version so
              students can try the core study features.
            </p>
          </div>

          <div className="faq-item">
            <h2>Can I use Steady Mate on my phone?</h2>
            <p>
              Yes. Steady Mate is being designed with a
              mobile-first experience so students can study
              from their phones.
            </p>
          </div>

          <div className="faq-item">
            <h2>Does Steady Mate track my progress?</h2>
            <p>
              Yes. Steady Mate is designed to track quiz
              performance, identify weak topics, and help
              students understand what they should review.
            </p>
          </div>

          <div className="faq-item">
            <h2>How can I contact Steady Mate?</h2>
            <p>
              You can follow Steady Mate through its social
              media channels or use the contact options
              provided on the platform.
            </p>
          </div>

        </section>

      </main>

      <Footer />
    </>
  )
}

export default FAQ