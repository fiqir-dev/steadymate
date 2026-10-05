import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"

type WorkspaceTopbarProps = {
  currentPath: string
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

const pageInfo: Record<
  string,
  {
    title: string
    subtitle: string
  }
> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Your study overview",
  },

  "/materials": {
    title: "My Materials",
    subtitle: "Manage your study materials",
  },

  "/study": {
    title: "Study",
    subtitle: "Focus and learn",
  },

  "/ai-tutor": {
    title: "AI Tutor",
    subtitle: "Learn with your personal AI tutor",
  },

  "/notes": {
    title: "Short Notes",
    subtitle: "Review your key ideas",
  },

  "/flashcards": {
    title: "Flashcards",
    subtitle: "Strengthen your memory",
  },

  "/quizzes": {
    title: "Quizzes",
    subtitle: "Test what you know",
  },

  "/progress": {
    title: "Progress",
    subtitle: "Track your learning journey",
  },

  "/profile": {
    title: "Profile",
    subtitle: "Manage your account",
  },
}

function WorkspaceTopbar({
  currentPath,
  isSidebarOpen,
  onToggleSidebar,
}: WorkspaceTopbarProps) {
  const current =
    pageInfo[currentPath] ??
    pageInfo["/dashboard"]

  return (
    <header className="workspace-topbar">

      {/* LEFT */}

      <div className="workspace-topbar-left">

        {/* MOBILE MENU */}

        <button
          type="button"
          className="workspace-menu-button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          title="Toggle navigation"
        >
          <Menu size={20} />
        </button>

        {/* PAGE TITLE */}

        <div className="workspace-page-heading">

          <h1>
            {current.title}
          </h1>

          <p>
            {current.subtitle}
          </p>

        </div>

      </div>

      {/* DESKTOP SIDEBAR BUTTON */}

      <button
        type="button"
        className="workspace-desktop-toggle"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
      >
        {isSidebarOpen ? (
          <PanelLeftClose size={19} />
        ) : (
          <PanelLeftOpen size={19} />
        )}
      </button>

    </header>
  )
}

export default WorkspaceTopbar