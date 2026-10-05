import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import AppearanceToggle from "./AppearanceToggle"

function Navbar() {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const isActive = (path: string) => location.pathname === path

  const closeMenu = () => setIsOpen(false)

  return (
    <nav className="navbar">
      <Link to="/" className="logo" onClick={closeMenu}>
        <img src="/logo.png" alt="Steady Mate" />
      </Link>

      <button
        className="nav-toggle"
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`navbar-menu ${isOpen ? "open" : ""}`}>
        <div className="nav-links">
          <Link
            to="/features"
            className={isActive("/features") ? "active" : ""}
            onClick={closeMenu}
          >
            Features
          </Link>

          <Link
            to="/how-it-works"
            className={isActive("/how-it-works") ? "active" : ""}
            onClick={closeMenu}
          >
            How It Works
          </Link>

          <Link
            to="/about"
            className={isActive("/about") ? "active" : ""}
            onClick={closeMenu}
          >
            About
          </Link>
        </div>

        <div className="nav-actions">
          <AppearanceToggle />

          <Link to="/login" className="btn btn-secondary" onClick={closeMenu}>
            Sign In
          </Link>

          <Link to="/signup" className="btn btn-primary" onClick={closeMenu}>
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar