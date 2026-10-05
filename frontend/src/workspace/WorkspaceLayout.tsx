import { useEffect, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  FileText,
  FolderOpen,
  Layers3,
  MessageCircle,
  Sparkles,
  Users,
  BadgeDollarSign,
} from "lucide-react"

import WorkspaceSidebar from "./WorkspaceSidebar"
import WorkspaceTopbar from "./WorkspaceTopbar"
import "./Workspace.css"

const baseNavigation = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: BarChart3,
  },
  {
    label: "My Materials",
    path: "/materials",
    icon: FolderOpen,
  },
  {
    label: "Study",
    path: "/study",
    icon: BookOpen,
  },
  {
    label: "AI Tutor",
    path: "/ai-tutor",
    icon: MessageCircle,
  },
  {
    label: "Short Notes",
    path: "/notes",
    icon: FileText,
  },
  {
    label: "Flashcards",
    path: "/flashcards",
    icon: Layers3,
  },
  {
    label: "Quizzes",
    path: "/quizzes",
    icon: BrainCircuit,
  },
  {
    label: "Progress",
    path: "/progress",
    icon: BarChart3,
  },
  {
    label: "Premium",
    path: "/premium",
    icon: Sparkles,
  },
  {
    label: "Referrals",
    path: "/referrals",
    icon: BadgeDollarSign,
  },
] as const

function WorkspaceLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) return

    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || "Unable to verify admin status")
        setIsAdmin(data.user?.role === "admin")
      })
      .catch(() => {
        setIsAdmin(false)
      })
  }, [])

  const navigation = isAdmin
    ? [
        ...baseNavigation,
        {
          label: "Admin",
          path: "/admin",
          icon: Users,
        },
      ]
    : baseNavigation

  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => window.innerWidth > 900,
  )

  function closeSidebarOnMobile() {
    if (window.innerWidth <= 900) {
      setIsSidebarOpen(false)
    }
  }

  function toggleSidebar() {
    setIsSidebarOpen((current) => !current)
  }

  function handleLogout() {
    sessionStorage.removeItem("steadymate_token")
    navigate("/login")
  }

  return (
    <div
      className={`workspace-shell ${
        isSidebarOpen
          ? "sidebar-open"
          : "sidebar-collapsed"
      }`}
    >
      {/* MOBILE OVERLAY */}

      {isSidebarOpen && (
        <button
          type="button"
          className="workspace-overlay"
          aria-label="Close navigation"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}

      <WorkspaceSidebar
        isOpen={isSidebarOpen}
        navigation={navigation}
        currentPath={location.pathname}
        onToggle={toggleSidebar}
        onNavigate={closeSidebarOnMobile}
        onLogout={handleLogout}
      />

      {/* MAIN */}

      <div className="workspace-main">
        <WorkspaceTopbar
          currentPath={location.pathname}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
        />

        <main className="workspace-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default WorkspaceLayout