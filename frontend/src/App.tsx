import { useLayoutEffect } from "react"
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom"

import Landing from "./landing"
import Features from "./features"
import HowItWorks from "./how-it-works"
import About from "./about"

import Login from "./login"
import AdminLogin from "./admin-login"
import Signup from "./signup"
import ForgotPassword from "./forgot-Password"
import ResetPassword from "./reset-Password"

import WorkspaceLayout from "./workspace/WorkspaceLayout"

import Dashboard from "./workspace/dashboard/Dashboard"
import Profile from "./workspace/profile/Profile"
import Materials from "./workspace/materials/Materials"
import Study from "./workspace/study/Study"
import AiTutor from "./workspace/ai-tutor/AiTutor"
import Notes from "./workspace/notes/Notes"
import Flashcards from "./workspace/flashcards/Flashcards"
import Quizzes from "./workspace/quizzes/Quizzes"
import Progress from "./workspace/progress/Progress"
import Premium from "./workspace/premium/Premium"
import Referrals from "./workspace/referrals/Referrals"
import Admin from "./workspace/admin/Admin"

function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const previousScrollRestoration =
      window.history.scrollRestoration
    window.history.scrollRestoration = "manual"

    return () => {
      window.history.scrollRestoration =
        previousScrollRestoration
    }
  }, [])

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [pathname])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>

        {/* Public pages */}
        <Route path="/" element={<Landing />} />
        <Route path="/features" element={<Features />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />
        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        {/* Workspace */}
        <Route element={<WorkspaceLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/study" element={<Study />} />
          <Route path="/ai-tutor" element={<AiTutor />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/quizzes" element={<Quizzes />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/admin" element={<Admin />} />
        </Route>

      </Routes>
    </BrowserRouter>
  )
}

export default App