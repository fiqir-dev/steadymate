import type { ComponentType } from "react"
import { Link } from "react-router-dom"
import {
  PanelLeftClose,
  PanelLeftOpen,
  User,
  Home,
} from "lucide-react"

type NavigationItem = {
  label: string
  path: string
  icon: ComponentType<{ size?: number }>
}

type WorkspaceSidebarProps = {
  isOpen: boolean
  navigation: readonly NavigationItem[]
  currentPath: string
  onToggle: () => void
  onNavigate: () => void
  onLogout: () => void
}

function WorkspaceSidebar({
  isOpen,
  navigation,
  currentPath,
  onToggle,
  onNavigate,
  onLogout,
}: WorkspaceSidebarProps) {
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar-inner">

        {/* HEADER */}
        <div className="workspace-sidebar-header">

          <div className="workspace-sidebar-brand">
            <Link
              to="/"
              className="workspace-home-button"
              onClick={onNavigate}
              title="Back to home"
            >
              <Home size={18} />
            </Link>

            <Link
              to="/dashboard"
              className="workspace-logo"
              onClick={onNavigate}
            >
              <img src="/logo.png" alt="Steady Mate" />
            </Link>
          </div>

          <div className="workspace-sidebar-meta">
            <span>Student workspace</span>
          </div>

          <button
            type="button"
            className="workspace-sidebar-toggle"
            onClick={onToggle}
            aria-label={
              isOpen ? "Collapse sidebar" : "Expand sidebar"
            }
            title={
              isOpen ? "Collapse sidebar" : "Expand sidebar"
            }
          >
            {isOpen ? (
              <>
                <PanelLeftClose size={18} />
                <span>Collapse</span>
              </>
            ) : (
              <PanelLeftOpen size={18} />
            )}
          </button>

        </div>

        {/* NAVIGATION */}
        <nav
          className="workspace-navigation"
          aria-label="Workspace navigation"
        >
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = currentPath === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={
                  isActive
                    ? "workspace-nav-item active"
                    : "workspace-nav-item"
                }
                onClick={onNavigate}
              >
                <span className="workspace-nav-icon">
                  <Icon size={18} />
                </span>

                {isOpen && (
                  <span className="workspace-nav-label">
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* FOOTER */}
        <div className="workspace-sidebar-footer">

          <Link
            to="/profile"
            className={
              currentPath === "/profile"
                ? "workspace-nav-item active"
                : "workspace-nav-item"
            }
            onClick={onNavigate}
          >
            <span className="workspace-nav-icon">
              <User size={18} />
            </span>

            {isOpen && (
              <span className="workspace-nav-label">
                Profile
              </span>
            )}
          </Link>

          <button
            type="button"
            className="workspace-logout"
            onClick={onLogout}
          >
            {isOpen ? "Logout" : "↪"}
          </button>

        </div>

      </div>
    </aside>
  )
}

export default WorkspaceSidebar