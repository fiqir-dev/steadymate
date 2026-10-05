import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

function BackToHome() {
  return (
    <Link className="back-home" to="/">
      <ArrowLeft aria-hidden="true" size={16} />
      Back to home
    </Link>
  )
}

export default BackToHome
