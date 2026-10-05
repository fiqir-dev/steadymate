import Navbar from "./Navbar"
import Footer from "./Footer"
import BackToHome from "./BackToHome"
import { Camera, Music2, Play, Send } from "lucide-react"
import TelegramVerification from "./TelegramVerification"

const socialLinks = [
  { name: "Telegram", url: "https://t.me/steadymate", icon: Send },
  { name: "YouTube", url: "https://www.youtube.com/@fiker-b3s", icon: Play },
  { name: "TikTok", url: "https://www.tiktok.com/@steadymate_", icon: Music2 },
  { name: "Instagram", url: "https://www.instagram.com/steady_mate_", icon: Camera },
]

function About() {
  return (
    <>
      <Navbar />

      <main className="inner-page about-page">
        <BackToHome />
        <section className="page-hero">
          <p className="hero-label">ABOUT STEADY MATE</p>
          <h1>Built by a student.<br /><span>Designed for students.</span></h1>
          <p>
            Steady Mate started with a simple idea: studying should be easier,
            more organized, and more personalized.
          </p>
        </section>

        <section className="about-grid">
          <article className="founder-card">
            <p className="card-label">THE FOUNDER</p>
            <h2>Hi, I’m Fiker.</h2>
            <p>
              I’m Fiker, a student and software developer from Ethiopia with a
              strong interest in AI, web development, IT, robotics, and technology.
            </p>
            <p>
              I created Steady Mate because I wanted students to have a simple
              and practical study companion that can turn their own study
              materials into useful learning resources.
            </p>
          </article>

          <article className="vision-card">
            <p className="card-label">THE VISION</p>
            <h2>Learning should feel more organized.</h2>
            <p>
              Steady Mate is being built especially with Ethiopian students in
              mind, while keeping the vision open to students across Africa and,
              eventually, worldwide.
            </p>
            <p>
              The goal is to help students understand their materials, practice
              with purpose, and study with less confusion.
            </p>
          </article>
        </section>

        <section className="about-contact-grid">
          <article className="about-panel">
            <p className="card-label">CONNECT</p>
            <h2>Follow Steady Mate</h2>
            <div className="about-social-links">
              {socialLinks.map(({ name, url, icon: Icon }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon aria-hidden="true" size={19} strokeWidth={2} />
                  <span>{name}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </article>

          <article className="about-panel">
            <p className="card-label">CONTACT</p>
            <h2>Have a question?</h2>
            <p>
              Reach out through email for questions or feedback about Steady Mate.
            </p>
            <a
              className="email-link"
              href="mailto:[REPLACE_WITH_MY_EMAIL]"
            >
              fiqirderese@gmail.com
            </a>
          </article>
        </section>

        <section className="trust-section">
          <div className="section-heading">
            <p>TRUST & VERIFICATION</p>
            <h2>Account verification through our official Telegram support bot.</h2>
          </div>
          <TelegramVerification />
        </section>
      </main>

      <Footer />
    </>
  )
}

export default About