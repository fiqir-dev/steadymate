import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  Trophy,
} from "lucide-react"

import AiGenerationStatus from "../AiGenerationStatus"
import "./Quizzes.css"

type Material = {
  _id: string
  title: string
  originalName: string
}

type QuizQuestion = {
  question: string
  options: string[]
  answer: string
  explanation: string
}

type Difficulty = "simple" | "medium" | "hard"
type AnswerFeedbackMode = "instant" | "review"

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"

function Quizzes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedMaterialId = searchParams.get("material")

  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState("")

  const [difficulty, setDifficulty] =
    useState<Difficulty>("medium")

  const [answerFeedbackMode, setAnswerFeedbackMode] =
    useState<AnswerFeedbackMode>("review")

  const [quiz, setQuiz] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<
    Record<number, string>
  >({})

  const [currentQuestion, setCurrentQuestion] =
    useState(0)

  const [loadingMaterials, setLoadingMaterials] =
    useState(true)

  const [generating, setGenerating] =
    useState(false)

  const [submitted, setSubmitted] =
    useState(false)

  const [error, setError] = useState("")

  useEffect(() => {
    const token =
      sessionStorage.getItem("steadymate_token")

    if (!token) {
      navigate("/login")
      return
    }

    fetch(`${API_URL}/api/materials`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            "Unable to load study materials.",
          )
        }

        const contentType =
          response.headers.get("content-type") || ""

        if (!contentType.includes("application/json")) {
          const text = await response.text()

          console.error(
            "Materials endpoint returned non-JSON:",
            text,
          )

          throw new Error(
            "The materials API is not responding correctly.",
          )
        }

        const data = await response.json()

        return data.materials || []
      })
      .then((loadedMaterials) => {
        setMaterials(loadedMaterials)

        if (loadedMaterials.length > 0) {
          const savedMaterial =
            requestedMaterialId ||
            sessionStorage.getItem("steadymate_selected_material_id") ||
            ""
          const selectedId = loadedMaterials.some(
            (material: Material) => material._id === savedMaterial,
          )
            ? savedMaterial
            : loadedMaterials[0]._id
          setSelectedMaterial(selectedId)
          sessionStorage.setItem("steadymate_selected_material_id", selectedId)
        }
      })
      .catch((err) => {
        console.error(
          "Load materials error:",
          err,
        )

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your study materials.",
        )
      })
      .finally(() => {
        setLoadingMaterials(false)
      })
  }, [navigate, requestedMaterialId])

  async function generateQuiz() {
    if (generating) return

    if (!selectedMaterial) {
      setError("Please select a study material.")
      return
    }

    const token =
      sessionStorage.getItem("steadymate_token")

    if (!token) {
      navigate("/login")
      return
    }

    setGenerating(true)
    setError("")

    try {
      const url =
        `${API_URL}/api/ai-tutor/quiz`

      console.log(
        "====================================",
      )
      console.log("QUIZ REQUEST URL:", url)
      console.log(
        "QUIZ MATERIAL:",
        selectedMaterial,
      )
      console.log(
        "QUIZ DIFFICULTY:",
        difficulty,
      )
      console.log(
        "====================================",
      )

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          materialId: selectedMaterial,
          difficulty,
        }),
      })

      const rawResponse = await response.text()

      console.log(
        "QUIZ STATUS:",
        response.status,
      )

      console.log(
        "QUIZ CONTENT TYPE:",
        response.headers.get("content-type"),
      )

      console.log(
        "QUIZ RESPONSE:",
        rawResponse,
      )

      if (!response.ok) {
        throw new Error(
          `Quiz API error ${response.status}: ${rawResponse.slice(
            0,
            500,
          )}`,
        )
      }

      let data

      try {
        data = JSON.parse(rawResponse)
      } catch {
        throw new Error(
          "Quiz API returned HTML/text instead of JSON. Check the backend server and route.",
        )
      }

      if (!Array.isArray(data.quiz)) {
        throw new Error(
          data.message ||
            "The server did not return a valid quiz.",
        )
      }

      if (data.quiz.length === 0) {
        throw new Error(
          "No quiz questions were generated.",
        )
      }

      setQuiz(data.quiz)
      setAnswers({})
      setCurrentQuestion(0)
      setSubmitted(false)
    } catch (err) {
      console.error(
        "Generate quiz error:",
        err,
      )

      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate quiz.",
      )
    } finally {
      setGenerating(false)
    }
  }

  function selectAnswer(answer: string) {
    if (
      submitted ||
      (answerFeedbackMode === "instant" &&
        answers[currentQuestion])
    ) {
      return
    }

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion]: answer,
    }))
  }

  function calculateScore() {
    return quiz.reduce(
      (score, question, index) =>
        score +
        (answers[index] === question.answer
          ? 1
          : 0),
      0,
    )
  }

  async function saveQuizAttempt() {
    const token =
      sessionStorage.getItem("steadymate_token")

    if (!token) {
      navigate("/login")
      return
    }

    const correctAnswers = calculateScore()

    const score = Math.round(
      (correctAnswers / quiz.length) * 100,
    )

    const savedAnswers = quiz.map(
      (question, index) => ({
        questionIndex: index,
        selectedAnswer:
          answers[index] || "",
        correctAnswer: question.answer,
        isCorrect:
          answers[index] === question.answer,
      }),
    )

    const response = await fetch(
      `${API_URL}/api/quiz-attempts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          materialId: selectedMaterial,
          difficulty,
          totalQuestions: quiz.length,
          correctAnswers,
          score,
          answers: savedAnswers,
        }),
      },
    )

    const contentType =
      response.headers.get("content-type") || ""

    if (!contentType.includes("application/json")) {
      const text = await response.text()

      console.error(
        "Quiz attempt endpoint returned non-JSON:",
        text,
      )

      throw new Error(
        "The quiz result API is not responding correctly.",
      )
    }

    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Unable to save quiz attempt.",
      )
    }

    return data
  }

  async function submitQuiz() {
    setError("")

    try {
      await saveQuizAttempt()
      setSubmitted(true)
    } catch (err) {
      console.error(
        "Submit quiz error:",
        err,
      )

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save quiz result.",
      )
    }
  }

  function restartQuiz() {
    setQuiz([])
    setAnswers({})
    setCurrentQuestion(0)
    setSubmitted(false)
    setError("")
  }

  if (submitted) {
    const score = calculateScore()

    const percentage = Math.round(
      (score / quiz.length) * 100,
    )

    return (
      <div className="quizzes-page">
        <section className="quiz-result-card">
          <div className="quiz-result-icon">
            <Trophy size={30} />
          </div>

          <p className="quiz-eyebrow">
            QUIZ COMPLETE
          </p>

          <h1>
            {percentage >= 80
              ? "Great work!"
              : percentage >= 60
                ? "Good effort!"
                : "Keep practicing!"}
          </h1>

          <p className="quiz-result-subtitle">
            You answered {score} of {quiz.length}{" "}
            questions correctly.
          </p>

          <div className="quiz-score">
            <strong>{percentage}%</strong>

            <span>
              {score} / {quiz.length} correct
            </span>
          </div>

          <div className="quiz-result-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                setSubmitted(false)
                setCurrentQuestion(0)
              }}
            >
              Review answers
            </button>

            <button
              className="btn btn-secondary"
              onClick={restartQuiz}
            >
              <RotateCcw size={16} />
              New quiz
            </button>
          </div>
        </section>

        <section className="quiz-review">
          <div className="quiz-section-heading">
            <p className="quiz-eyebrow">
              REVIEW
            </p>

            <h2>Your answers</h2>
          </div>

          {quiz.map((question, index) => {
            const isCorrect =
              answers[index] === question.answer

            return (
              <article
                className={`quiz-review-item ${
                  isCorrect
                    ? "quiz-review-correct"
                    : "quiz-review-wrong"
                }`}
                key={index}
              >
                <div className="quiz-review-status">
                  {isCorrect ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <span>×</span>
                  )}
                </div>

                <div>
                  <span className="quiz-review-number">
                    Question {index + 1}
                  </span>

                  <h3>{question.question}</h3>

                  <p>
                    Your answer:{" "}
                    <strong>
                      {answers[index] ||
                        "Not answered"}
                    </strong>
                  </p>

                  {!isCorrect && (
                    <p>
                      Correct answer:{" "}
                      <strong>
                        {question.answer}
                      </strong>
                    </p>
                  )}

                  <small>
                    {question.explanation}
                  </small>
                </div>
              </article>
            )
          })}
        </section>
      </div>
    )
  }

  if (quiz.length > 0) {
    const question = quiz[currentQuestion]

    const selectedAnswer =
      answers[currentQuestion]

    const feedbackRevealed =
      answerFeedbackMode === "instant" &&
      Boolean(selectedAnswer)

    const isLastQuestion =
      currentQuestion === quiz.length - 1

    return (
      <div className="quizzes-page">
        <div className="quiz-active-header">
          <div>
            <p className="quiz-eyebrow">
              {difficulty.toUpperCase()} QUIZ
            </p>

            <h1>Test your knowledge</h1>
          </div>

          <span className="quiz-question-count">
            {currentQuestion + 1} / {quiz.length}
          </span>
        </div>

        <div className="quiz-progress">
          <span
            style={{
              width: `${
                ((currentQuestion + 1) /
                  quiz.length) *
                100
              }%`,
            }}
          />
        </div>

        {error && (
          <div className="quiz-error">
            {error}
          </div>
        )}

        <section className="quiz-question-card">
          <span className="quiz-question-label">
            Question {currentQuestion + 1}
          </span>

          <h2>{question.question}</h2>

          <div className="quiz-options">
            {question.options.map(
              (option, index) => (
                <button
                  key={option}
                  type="button"
                  className={`quiz-option ${
                    selectedAnswer === option
                      ? "selected"
                      : ""
                  } ${
                    feedbackRevealed &&
                    option === question.answer
                      ? "correct"
                      : ""
                  } ${
                    feedbackRevealed &&
                    selectedAnswer === option &&
                    option !== question.answer
                      ? "incorrect"
                      : ""
                  }`}
                  disabled={feedbackRevealed}
                  aria-pressed={selectedAnswer === option}
                  onClick={() =>
                    selectAnswer(option)
                  }
                >
                  <span>
                    {String.fromCharCode(
                      65 + index,
                    )}
                  </span>

                  {option}
                </button>
              ),
            )}
          </div>

          {feedbackRevealed && (
            <div
              className={`quiz-answer-feedback ${
                selectedAnswer === question.answer
                  ? "quiz-answer-feedback-correct"
                  : "quiz-answer-feedback-incorrect"
              }`}
              role="status"
              aria-live="polite"
            >
              <strong>
                {selectedAnswer === question.answer
                  ? "Correct!"
                  : "Not quite"}
              </strong>
              {selectedAnswer !== question.answer && (
                <p>
                  Correct answer: {question.answer}
                </p>
              )}
              <p>{question.explanation}</p>
            </div>
          )}

          <div className="quiz-navigation">
            <button
              className="btn btn-secondary"
              disabled={currentQuestion === 0}
              onClick={() =>
                setCurrentQuestion(
                  (previous) =>
                    previous - 1,
                )
              }
            >
              <ChevronLeft size={17} />
              Previous
            </button>

            {isLastQuestion ? (
              <button
                className="btn btn-primary"
                disabled={!selectedAnswer}
                onClick={submitQuiz}
              >
                {answerFeedbackMode === "instant"
                  ? "Finish quiz"
                  : "Submit quiz"}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                disabled={!selectedAnswer}
                onClick={() =>
                  setCurrentQuestion(
                    (previous) =>
                      previous + 1,
                  )
                }
              >
                {answerFeedbackMode === "instant"
                  ? "Next Question"
                  : "Next"}
                <ChevronRight size={17} />
              </button>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="quizzes-page">
      <header className="quiz-page-header">
        <div>
          <p className="quiz-eyebrow">
            PRACTICE & ASSESS
          </p>

          <h1>Quizzes</h1>

          <p>
            Test your understanding using your own
            study materials.
          </p>
        </div>
      </header>

      {error && (
        <div className="quiz-error">
          {error}
        </div>
      )}

      <section className="quiz-setup-card">
        <div className="quiz-setup-icon">
          <BookOpen size={23} />
        </div>

        <div className="quiz-setup-heading">
          <h2>Create a quiz</h2>

          <p>
            Choose your material, difficulty, and
            how you want to review answers.
          </p>
        </div>

        <div className="quiz-field">
          <label htmlFor="quiz-material">
            Study material
          </label>

          {loadingMaterials ? (
            <div className="quiz-loading">
              Loading your materials...
            </div>
          ) : materials.length === 0 ? (
            <div className="quiz-no-materials">
              <p>
                You don't have any study materials
                yet.
              </p>

              <button
                className="btn btn-primary"
                onClick={() =>
                  navigate("/materials")
                }
              >
                Upload material
              </button>
            </div>
          ) : (
            <select
              id="quiz-material"
              value={selectedMaterial}
              disabled={generating}
              onChange={(event) =>
                {
                  setSelectedMaterial(event.target.value)
                  sessionStorage.setItem(
                    "steadymate_selected_material_id",
                    event.target.value,
                  )
                }
              }
            >
              {materials.map((material) => (
                <option
                  key={material._id}
                  value={material._id}
                >
                  {material.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {materials.length > 0 && (
          <>
            <div className="quiz-field">
              <label>Difficulty</label>

              <div className="quiz-difficulty-grid">
                <button
                  type="button"
                  className={`quiz-difficulty ${
                    difficulty === "simple"
                      ? "selected"
                      : ""
                  }`}
                  disabled={generating}
                  onClick={() =>
                    setDifficulty("simple")
                  }
                >
                  <strong>Simple</strong>

                  <span>
                    Basic recall and understanding
                  </span>
                </button>

                <button
                  type="button"
                  className={`quiz-difficulty ${
                    difficulty === "medium"
                      ? "selected"
                      : ""
                  }`}
                  disabled={generating}
                  onClick={() =>
                    setDifficulty("medium")
                  }
                >
                  <strong>Medium</strong>

                  <span>
                    Understanding and application
                  </span>
                </button>

                <button
                  type="button"
                  className={`quiz-difficulty ${
                    difficulty === "hard"
                      ? "selected"
                      : ""
                  }`}
                  disabled={generating}
                  onClick={() =>
                    setDifficulty("hard")
                  }
                >
                  <strong>Hard</strong>

                  <span>
                    Deeper reasoning and problem
                    solving
                  </span>
                </button>
              </div>
            </div>

            <div className="quiz-field">
              <span
                className="quiz-field-label"
                id="quiz-feedback-label"
              >
                Answer feedback
              </span>

              <div
                className="quiz-feedback-options"
                role="radiogroup"
                aria-labelledby="quiz-feedback-label"
              >
                <label
                  className={`quiz-feedback-option ${
                    answerFeedbackMode === "instant"
                      ? "selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="quiz-feedback-mode"
                    value="instant"
                    checked={
                      answerFeedbackMode === "instant"
                    }
                    disabled={generating}
                    onChange={() =>
                      setAnswerFeedbackMode("instant")
                    }
                  />
                  <span className="quiz-feedback-radio" />
                  <span className="quiz-feedback-copy">
                    <strong>Instant Feedback</strong>
                    <span>
                      Know immediately whether your
                      answer is correct.
                    </span>
                  </span>
                </label>

                <label
                  className={`quiz-feedback-option ${
                    answerFeedbackMode === "review"
                      ? "selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="quiz-feedback-mode"
                    value="review"
                    checked={
                      answerFeedbackMode === "review"
                    }
                    disabled={generating}
                    onChange={() =>
                      setAnswerFeedbackMode("review")
                    }
                  />
                  <span className="quiz-feedback-radio" />
                  <span className="quiz-feedback-copy">
                    <strong>Review After Quiz</strong>
                    <span>
                      Finish the quiz first, then review
                      your answers.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {generating && (
              <AiGenerationStatus
                title="Generating your quiz..."
                description="Creating questions from your study material."
                detail={`${difficulty.charAt(0).toUpperCase() +
                  difficulty.slice(1)} difficulty`}
              />
            )}

            <button
              className="btn btn-primary quiz-generate-button"
              onClick={generateQuiz}
              disabled={generating}
            >
              {generating && (
                <LoaderCircle
                  className="quiz-spinner"
                  size={17}
                  aria-hidden="true"
                />
              )}
              {generating ? "Generating Quiz..." : "Generate quiz"}
            </button>
          </>
        )}
      </section>
    </div>
  )
}

export default Quizzes