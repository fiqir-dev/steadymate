import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  Sparkles,
} from "lucide-react"

import AiGenerationStatus from "../AiGenerationStatus"
import "../StudyTools.css"
import "./Notes.css"

type NoteDepth = "quick" | "standard" | "detailed" | "deep"
type NotesOrganization = "whole" | "section" | "chapter"
type NoteSection = {
  title: string
  coreIdeas: string[]
  keyDefinitions: ShortNotes["keyDefinitions"]
  importantFacts: string[]
  processes: string[]
  quickRevision: string
  sectionOverview?: string
  detailedExplanation?: string
  importantRelationships?: string[]
  examples: string[]
  commonMistakes: string[]
}

type Material = {
  _id: string
  title: string
}

type ShortNotes = {
  depth?: NoteDepth
  organization?: NotesOrganization
  coreIdeas: string[]
  keyDefinitions: Array<{
    term: string
    definition: string
  }>
  importantFacts: string[]
  processes: string[]
  quickRevision: string
  examples?: string[]
  commonMistakes?: string[]
  sections?: NoteSection[]
}

type ApiData = {
  success: boolean
  message?: string
  materials?: Material[]
  shortNotes?: ShortNotes
  studyContent?: {
    shortNotes: ShortNotes | null
  }
}

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"
const SELECTED_MATERIAL_KEY = "steadymate_selected_material_id"

const depthOptions: Array<{
  value: NoteDepth
  label: string
  description: string
}> = [
  {
    value: "quick",
    label: "Quick",
    description: "Key facts for fast revision",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Balanced everyday study notes",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "More explanation and connections",
  },
  {
    value: "deep",
    label: "Deep Study",
    description: "Thorough, organized learning material",
  },
]

function NotesBody({
  notes,
  title,
}: {
  notes: ShortNotes
  title: string
}) {
  return (
    <div className="notes-content">
      <section className="study-tool-card notes-section">
        <div className="notes-section-heading">
          <span>01</span><h2>Core ideas</h2>
        </div>
        {notes.coreIdeas.length ? (
          <ul>{notes.coreIdeas.map((idea, index) => (
            <li key={`${index}-${idea}`}>{idea}</li>
          ))}</ul>
        ) : <p className="notes-empty-category">No core ideas identified.</p>}
      </section>

      <section className="study-tool-card notes-section">
        <div className="notes-section-heading">
          <span>02</span><h2>Key definitions</h2>
        </div>
        {notes.keyDefinitions.length ? (
          <dl className="notes-definitions">
            {notes.keyDefinitions.map(({ term, definition }) => (
              <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>
            ))}
          </dl>
        ) : <p className="notes-empty-category">No key definitions identified.</p>}
      </section>

      <section className="study-tool-card notes-section">
        <div className="notes-section-heading">
          <span>03</span><h2>Important facts</h2>
        </div>
        {notes.importantFacts.length ? (
          <ul>{notes.importantFacts.map((fact, index) => (
            <li key={`${index}-${fact}`}>{fact}</li>
          ))}</ul>
        ) : <p className="notes-empty-category">No additional facts identified.</p>}
      </section>

      {notes.processes.length > 0 && (
        <section className="study-tool-card notes-section">
          <div className="notes-section-heading">
            <span>04</span><h2>Processes</h2>
          </div>
          <ol>{notes.processes.map((process, index) => (
            <li key={`${index}-${process}`}>{process}</li>
          ))}</ol>
        </section>
      )}

      {(notes.examples?.length || 0) > 0 && (
        <section className="study-tool-card notes-section">
          <div className="notes-section-heading">
            <span>05</span><h2>Examples</h2>
          </div>
          <ul>{notes.examples?.map((example, index) => (
            <li key={`${index}-${example}`}>{example}</li>
          ))}</ul>
        </section>
      )}

      {(notes.commonMistakes?.length || 0) > 0 && (
        <section className="study-tool-card notes-section">
          <div className="notes-section-heading">
            <span>06</span><h2>Common mistakes to avoid</h2>
          </div>
          <ul>{notes.commonMistakes?.map((mistake, index) => (
            <li key={`${index}-${mistake}`}>{mistake}</li>
          ))}</ul>
        </section>
      )}

      <section className="study-tool-card notes-section notes-quick-revision">
        <div className="notes-section-heading">
          <span>07</span><h2>Quick revision</h2>
        </div>
        <p>{notes.quickRevision}</p>
        <small>
          {title}
          {notes.depth && ` · ${notes.depth.replace("deep", "deep study")} notes`}
        </small>
      </section>
    </div>
  )
}

function SectionDetail({ section }: { section: NoteSection }) {
  return (
    <section className="study-tool-card notes-section notes-detail">
      <div className="notes-section-heading">
        <span>+</span><h2>Detailed explanation</h2>
      </div>
      {section.sectionOverview || section.detailedExplanation ? (
        <>
          {section.sectionOverview && (
            <div className="notes-detail-block">
              <h3>Section overview</h3>
              <p>{section.sectionOverview}</p>
            </div>
          )}
          {section.coreIdeas.length > 0 && (
            <div className="notes-detail-block">
              <h3>Main concepts</h3>
              <ul>{section.coreIdeas.map((concept, index) => (
                <li key={`${index}-${concept}`}>{concept}</li>
              ))}</ul>
            </div>
          )}
          {section.detailedExplanation && (
            <div className="notes-detail-block">
              <h3>Explanation</h3>
              <p>{section.detailedExplanation}</p>
            </div>
          )}
          {(section.importantRelationships?.length || 0) > 0 && (
            <div className="notes-detail-block">
              <h3>Important relationships</h3>
              <ul>{section.importantRelationships?.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}</ul>
            </div>
          )}
          {section.examples.length > 0 && (
            <div className="notes-detail-block">
              <h3>Examples from the material</h3>
              <ul>{section.examples.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}</ul>
            </div>
          )}
          {section.commonMistakes.length > 0 && (
            <div className="notes-detail-block">
              <h3>Common mistakes to avoid</h3>
              <ul>{section.commonMistakes.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}</ul>
            </div>
          )}
          <div className="notes-detail-block">
            <h3>Quick revision</h3>
            <p>{section.quickRevision}</p>
          </div>
        </>
      ) : (
        <p className="notes-detail-unavailable">
          This saved section predates detailed explanations. Regenerate the
          notes to create a material-grounded explanation.
        </p>
      )}
    </section>
  )
}

function Notes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedMaterialId = searchParams.get("material")

  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedMaterialId, setSelectedMaterialId] = useState("")
  const [shortNotes, setShortNotes] = useState<ShortNotes | null>(null)
  const [notesMaterialId, setNotesMaterialId] = useState("")
  const [depth, setDepth] = useState<NoteDepth>("standard")
  const [organization, setOrganization] =
    useState<NotesOrganization>("whole")
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [showSectionDetail, setShowSectionDetail] = useState(false)
  const generationInFlight = useRef(false)

  useEffect(() => {
    let active = true

    async function loadMaterials() {
      const token = sessionStorage.getItem("steadymate_token")

      if (!token) {
        navigate("/login")
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/materials`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = (await response.json()) as ApiData

        if (!response.ok) {
          throw new Error(data.message || "Unable to load materials.")
        }

        if (!active) return
        const loadedMaterials = data.materials || []
        setMaterials(loadedMaterials)

        const preferredId =
          requestedMaterialId ||
          sessionStorage.getItem(SELECTED_MATERIAL_KEY) ||
          ""
        const selectedId = loadedMaterials.some(
          (material) => material._id === preferredId,
        )
          ? preferredId
          : loadedMaterials[0]?._id || ""

        setSelectedMaterialId(selectedId)
        if (selectedId) {
          sessionStorage.setItem(SELECTED_MATERIAL_KEY, selectedId)
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load materials.",
          )
        }
      } finally {
        if (active) setLoadingMaterials(false)
      }
    }

    void loadMaterials()
    return () => {
      active = false
    }
  }, [navigate, requestedMaterialId])

  useEffect(() => {
    if (!selectedMaterialId) return

    let active = true
    const token = sessionStorage.getItem("steadymate_token")

    async function loadSavedNotes() {
      if (!token) {
        navigate("/login")
        return
      }

      try {
        const response = await fetch(
          `${API_URL}/api/study-content/${selectedMaterialId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        const data = (await response.json()) as ApiData

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load saved notes.",
          )
        }
        if (active) {
          const savedNotes = data.studyContent?.shortNotes || null
          setShortNotes(savedNotes)
          setCurrentSectionIndex(0)
          setShowSectionDetail(false)
          if (savedNotes?.depth) setDepth(savedNotes.depth)
          if (savedNotes?.organization) {
            setOrganization(savedNotes.organization)
          }
          setNotesMaterialId(selectedMaterialId)
          setError("")
        }
      } catch (loadError) {
        if (active) {
          setNotesMaterialId(selectedMaterialId)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load saved notes.",
          )
        }
      }
    }

    void loadSavedNotes()
    return () => {
      active = false
    }
  }, [navigate, selectedMaterialId])

  async function generateNotes() {
    if (
      !selectedMaterialId ||
      generationInFlight.current
    ) {
      return
    }

    const token = sessionStorage.getItem("steadymate_token")
    if (!token) {
      navigate("/login")
      return
    }

    const material = materials.find(
      (item) => item._id === selectedMaterialId,
    )
    if (!material) return

    generationInFlight.current = true
    setGenerating(true)
    setError("")
    setSuccess("")

    try {
      const generationResponse = await fetch(
        `${API_URL}/api/ai-tutor/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            materialId: selectedMaterialId,
            subject: material.title,
            depth,
            organization,
          }),
        },
      )
      const generationData =
        (await generationResponse.json()) as ApiData

      if (!generationResponse.ok || !generationData.shortNotes) {
        throw new Error(
          generationData.message || "Unable to generate short notes.",
        )
      }

      const saveResponse = await fetch(
        `${API_URL}/api/study-content/${selectedMaterialId}/notes`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            shortNotes: generationData.shortNotes,
          }),
        },
      )
      const saveData = (await saveResponse.json()) as ApiData

      if (!saveResponse.ok) {
        throw new Error(
          saveData.message ||
            "Notes were generated but could not be saved.",
        )
      }

      setShortNotes(
        saveData.studyContent?.shortNotes ||
          generationData.shortNotes,
      )
      setCurrentSectionIndex(0)
      setShowSectionDetail(false)
      setDepth(
        generationData.shortNotes.depth || depth,
      )
      setOrganization(
        generationData.shortNotes.organization || "whole",
      )
      setNotesMaterialId(selectedMaterialId)
      setSuccess(`Notes saved for ${material.title}.`)
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate short notes.",
      )
    } finally {
      generationInFlight.current = false
      setGenerating(false)
    }
  }

  const selectedMaterial = materials.find(
    (material) => material._id === selectedMaterialId,
  )
  const notesAreLoading =
    Boolean(selectedMaterialId) &&
    notesMaterialId !== selectedMaterialId
  const visibleNotes =
    notesMaterialId === selectedMaterialId
      ? shortNotes
      : null

  return (
    <div className="notes-page workspace-study-tool">
      <header className="study-tool-header">
        <div className="study-tool-icon">
          <FileText size={22} />
        </div>
        <div>
          <p className="study-tool-eyebrow">REVIEW YOUR MATERIAL</p>
          <h1>Short Notes</h1>
          <p>AI-generated study notes, saved with the material they came from.</p>
        </div>
      </header>

      {error && <div className="study-tool-error" role="alert">{error}</div>}
      {success && <div className="study-tool-success" role="status">{success}</div>}

      <section className="study-tool-card notes-controls">
        <label htmlFor="notes-material">Study material</label>
        {loadingMaterials ? (
          <div className="study-tool-loading">Loading your materials...</div>
        ) : materials.length ? (
          <div className="study-tool-controls-row">
            <select
              id="notes-material"
              value={selectedMaterialId}
              disabled={generating || notesAreLoading}
              onChange={(event) => {
                const nextId = event.target.value
                setSelectedMaterialId(nextId)
                setShortNotes(null)
                setNotesMaterialId("")
                setCurrentSectionIndex(0)
                setShowSectionDetail(false)
                sessionStorage.setItem(SELECTED_MATERIAL_KEY, nextId)
                setSuccess("")
              }}
            >
              {materials.map((material) => (
                <option key={material._id} value={material._id}>
                  {material.title}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="study-tool-empty-inline">
            <p>No study materials yet. Upload material to generate notes.</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate("/materials")}
            >
              Upload material
            </button>
          </div>
        )}
        {selectedMaterial && (
          <p className="study-tool-selected">
            Notes for <strong>{selectedMaterial.title}</strong>
          </p>
        )}
        {materials.length > 0 && (
          <>
            <fieldset className="notes-choice-group" disabled={generating}>
              <legend>Note depth</legend>
              <div className="notes-depth-grid">
                {depthOptions.map((option) => (
                  <label
                    className={`notes-choice-card ${
                      depth === option.value ? "selected" : ""
                    }`}
                    key={option.value}
                  >
                    <input
                      type="radio"
                      name="notes-depth"
                      value={option.value}
                      checked={depth === option.value}
                      onChange={() => setDepth(option.value)}
                    />
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="notes-choice-group notes-organization" disabled={generating}>
              <legend>Notes organization</legend>
              <div className="notes-organization-options">
                {([
                  ["whole", "Whole material", "One connected set of notes"],
                  ["section", "By section", "Use clear headings and section titles"],
                  ["chapter", "By chapter", "Use explicit chapter or unit headings"],
                ] as const).map(([value, label, description]) => (
                  <label
                    className={`notes-organization-option ${
                      organization === value ? "selected" : ""
                    }`}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="notes-organization"
                      value={value}
                      checked={organization === value}
                      onChange={() => setOrganization(value)}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              className="btn btn-primary notes-generate-button"
              type="button"
              disabled={generating || notesAreLoading}
              onClick={() => void generateNotes()}
            >
              {generating ? (
                <LoaderCircle
                  className="study-tool-spinner"
                  size={16}
                  aria-hidden="true"
                />
              ) : (
                <Sparkles size={16} aria-hidden="true" />
              )}
              {generating
                ? "Generating and saving..."
                : visibleNotes
                  ? "Regenerate notes"
                  : "Generate short notes"}
            </button>
          </>
        )}
      </section>

      {generating ? (
        <AiGenerationStatus
          title="Generating your study notes"
          description="Analyzing your material and preparing useful learning resources."
          detail={`${selectedMaterial?.title || "Selected material"} · ${
            depthOptions.find((option) => option.value === depth)?.label
          } · ${
            organization === "whole"
              ? "Whole material"
              : organization === "section"
                ? "By section"
                : "By chapter"
          }`}
        />
      ) : notesAreLoading ? (
        <div className="study-tool-loading study-tool-content-loading" role="status">
          Loading saved notes...
        </div>
      ) : visibleNotes ? (
        visibleNotes.sections && visibleNotes.sections.length > 0 ? (
          <div className="notes-organized-content" aria-label="Notes by section">
            <header className="notes-section-viewer-header">
              <div>
                <p className="notes-section-viewer-material">
                  {selectedMaterial?.title || "Study material"}
                </p>
                <h2>{visibleNotes.sections[currentSectionIndex]?.title}</h2>
                <p className="notes-section-viewer-count" aria-live="polite">
                  Section {currentSectionIndex + 1} of {visibleNotes.sections.length}
                </p>
              </div>
              <nav className="notes-section-navigation" aria-label="Section navigation">
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={currentSectionIndex === 0}
                  aria-label="Go to previous section"
                  onClick={() => {
                    setCurrentSectionIndex((index) => Math.max(0, index - 1))
                    setShowSectionDetail(false)
                  }}
                >
                  <ChevronLeft size={17} /> Previous
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={currentSectionIndex === visibleNotes.sections!.length - 1}
                  aria-label="Go to next section"
                  onClick={() => {
                    setCurrentSectionIndex((index) =>
                      Math.min(visibleNotes.sections!.length - 1, index + 1),
                    )
                    setShowSectionDetail(false)
                  }}
                >
                  Next <ChevronRight size={17} />
                </button>
              </nav>
            </header>
            {visibleNotes.sections[currentSectionIndex] && (
              <div
                className="notes-section-viewer"
                key={`${notesMaterialId}-${currentSectionIndex}`}
              >
                <NotesBody
                  notes={visibleNotes.sections[currentSectionIndex]}
                  title={visibleNotes.sections[currentSectionIndex].title}
                />
                <button
                  className="notes-detail-toggle"
                  type="button"
                  aria-expanded={showSectionDetail}
                  onClick={() => setShowSectionDetail((shown) => !shown)}
                >
                  {showSectionDetail
                    ? "Hide detailed explanation"
                    : "View detailed explanation"}
                </button>
                {showSectionDetail && (
                  <SectionDetail
                    section={visibleNotes.sections[currentSectionIndex]}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="notes-whole-content">
            {organization !== "whole" && (
              <p className="notes-structure-notice" role="status">
                No clear {organization === "chapter" ? "chapter" : "section"} headings
                were detected, so these notes cover the material as a whole.
              </p>
            )}
            <NotesBody
              notes={visibleNotes}
              title={selectedMaterial?.title || "Study material"}
            />
          </div>
        )
      ) : materials.length > 0 && !error ? (
        <section className="study-tool-card study-tool-empty">
          <div className="study-tool-empty-icon"><FileText size={22} /></div>
          <h2>No notes for this material yet</h2>
          <p>Generate a concise review using the selected material.</p>
        </section>
      ) : null}
    </div>
  )
}

export default Notes
