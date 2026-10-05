import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

function AppearanceToggle() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("steadymate_appearance") === "dark"
  })

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light"
    localStorage.setItem("steadymate_appearance", isDark ? "dark" : "light")
  }, [isDark])

  return (
    <button
      className="appearance-toggle"
      type="button"
      aria-label={isDark ? "Use light appearance" : "Use dark appearance"}
      title={isDark ? "Use light appearance" : "Use dark appearance"}
      onClick={() => setIsDark((dark) => !dark)}
    >
      {isDark ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
    </button>
  )
}

export default AppearanceToggle
