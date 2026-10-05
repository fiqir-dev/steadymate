import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardPaste,
  File,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react"

import "./Materials.css"

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000"

const SELECTED_MATERIAL_KEY =
  "steadymate_selected_material_id"

type Material = {
  _id?: string
  id?: string
  title: string
  originalName?: string
  mimeType?: string
  size?: number
  content?: string
  createdAt?: string
}

type AddMode = "file" | "text"

function getMaterialId(material: Material) {
  return material._id || material.id || ""
}

function formatFileSize(size?: number) {
  if (!size) return ""

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function Materials() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedMaterialId, setSelectedMaterialId] =
    useState(() =>
      sessionStorage.getItem(SELECTED_MATERIAL_KEY) || "",
    )

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState("")
  const [deleteTarget, setDeleteTarget] =
    useState<Material | null>(null)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [showAddModal, setShowAddModal] = useState(false)
  const [addMode, setAddMode] =
    useState<AddMode>("file")

  const [title, setTitle] = useState("")
  const [textContent, setTextContent] = useState("")
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null)

  const fileInputRef =
    useRef<HTMLInputElement>(null)

  const token =
    sessionStorage.getItem("steadymate_token")

  async function loadMaterials() {
    if (!token) {
      setError("Please sign in again.")
      setIsLoading(false)
      return
    }

    try {
      setError("")

      const response = await fetch(
        `${API_URL}/api/materials`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load materials.",
        )
      }

      setMaterials(data.materials || [])

      const savedId =
        sessionStorage.getItem(
          SELECTED_MATERIAL_KEY,
        )

      if (
        savedId &&
        (data.materials || []).some(
          (material: Material) =>
            getMaterialId(material) === savedId,
        )
      ) {
        setSelectedMaterialId(savedId)
      } else if (data.materials?.length) {
        const firstId = getMaterialId(
          data.materials[0],
        )

        setSelectedMaterialId(firstId)

        sessionStorage.setItem(
          SELECTED_MATERIAL_KEY,
          firstId,
        )
      } else {
        setSelectedMaterialId("")
        sessionStorage.removeItem(
          SELECTED_MATERIAL_KEY,
        )
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load materials.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMaterials()
  }, [])

  function selectMaterial(material: Material) {
    const id = getMaterialId(material)

    if (!id) return

    setSelectedMaterialId(id)

    sessionStorage.setItem(
      SELECTED_MATERIAL_KEY,
      id,
    )

    setSuccess(
      `"${material.title}" is now selected for AI study.`,
    )

    setTimeout(() => {
      setSuccess("")
    }, 3000)
  }

  function openAddModal() {
    setError("")
    setSuccess("")
    setTitle("")
    setTextContent("")
    setSelectedFile(null)
    setAddMode("file")
    setShowAddModal(true)
  }

  function closeAddModal() {
    if (isSubmitting) return

    setShowAddModal(false)
    setTitle("")
    setTextContent("")
    setSelectedFile(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]

    if (!file) return

    setSelectedFile(file)

    if (!title.trim()) {
      const filename = file.name
      const lastDot = filename.lastIndexOf(".")

      setTitle(
        lastDot > 0
          ? filename.substring(0, lastDot)
          : filename,
      )
    }
  }

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault()

    if (!token) {
      setError("Please sign in again.")
      return
    }

    if (addMode === "file" && !selectedFile) {
      setError("Please choose a file first.")
      return
    }

    if (
      addMode === "text" &&
      !textContent.trim()
    ) {
      setError("Please paste your study material.")
      return
    }

    setIsSubmitting(true)
    setError("")
    setSuccess("")

    try {
      let response: Response

      if (addMode === "file") {
        const formData = new FormData()

        formData.append("file", selectedFile!)

        if (title.trim()) {
          formData.append(
            "title",
            title.trim(),
          )
        }

        response = await fetch(
          `${API_URL}/api/materials`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          },
        )
      } else {
        response = await fetch(
          `${API_URL}/api/materials/text`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title:
                title.trim() ||
                "Untitled study material",
              content: textContent.trim(),
            }),
          },
        )
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to add material.",
        )
      }

      const newMaterial =
        data.material as Material

      const newId = getMaterialId(newMaterial)

      if (newId) {
        setSelectedMaterialId(newId)

        sessionStorage.setItem(
          SELECTED_MATERIAL_KEY,
          newId,
        )
      }

      setSuccess(
        "Material added successfully.",
      )

      closeAddModal()
      await loadMaterials()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add material.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDelete(material: Material) {
    setDeleteTarget(material)
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    const id = getMaterialId(deleteTarget)

    if (!id || !token) {
      setDeleteTarget(null)
      setError("Please sign in again.")
      return
    }

    setDeletingId(id)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(
        `${API_URL}/api/materials/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to delete material.",
        )
      }

      setMaterials((current) =>
        current.filter(
          (item) =>
            getMaterialId(item) !== id,
        ),
      )

      if (selectedMaterialId === id) {
        sessionStorage.removeItem(
          SELECTED_MATERIAL_KEY,
        )

        setSelectedMaterialId("")
      }

      setSuccess(
        `"${deleteTarget.title}" was deleted.`,
      )

      setDeleteTarget(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete material.",
      )
    } finally {
      setDeletingId("")
    }
  }

  return (
    <div className="materials-page">
      <div className="materials-header">
        <div>
          <p className="materials-eyebrow">
            LIBRARY
          </p>

          <h1>My Materials</h1>

          <p>
            Upload your study materials and turn
            them into notes, flashcards, quizzes,
            and AI tutoring.
          </p>
        </div>

        <button
          type="button"
          className="materials-upload-button"
          onClick={openAddModal}
        >
          <Plus size={18} />
          Add material
        </button>
      </div>

      {error && (
        <div className="materials-alert error">
          <AlertCircle size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="materials-alert success">
          <CheckCircle2 size={18} />
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {selectedMaterialId && (
        <div className="materials-selected-banner">
          <div className="materials-selected-icon">
            <BookOpen size={19} />
          </div>

          <div>
            <strong>Material selected</strong>

            <span>
              Your AI tools will use the selected
              material.
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="materials-loading">
          <Loader2 size={26} />
          <span>Loading your materials...</span>
        </div>
      ) : materials.length === 0 ? (
        <div className="materials-empty">
          <div className="materials-empty-icon">
            <BookOpen size={30} />
          </div>

          <h2>No materials yet</h2>

          <p>
            Add your notes, PDFs, documents, or
            pasted study material to start learning
            with Steady Mate.
          </p>

          <button
            type="button"
            className="materials-primary-button"
            onClick={openAddModal}
          >
            <Plus size={18} />
            Add your first material
          </button>
        </div>
      ) : (
        <div className="materials-grid">
          {materials.map((material) => {
            const id = getMaterialId(material)

            const isSelected =
              id === selectedMaterialId

            const isDeleting =
              id === deletingId

            return (
              <article
                key={id}
                className={`material-card ${
                  isSelected ? "selected" : ""
                }`}
              >
                <button
                  type="button"
                  className="material-card-main"
                  onClick={() =>
                    selectMaterial(material)
                  }
                >
                  <div className="material-file-icon">
                    {material.mimeType?.includes(
                      "pdf",
                    ) ? (
                      <FileText size={22} />
                    ) : (
                      <File size={22} />
                    )}
                  </div>

                  <div className="material-card-info">
                    <h3>{material.title}</h3>

                    <p>
                      {material.originalName ||
                        "Text study material"}
                    </p>

                    <div className="material-meta">
                      {material.size &&
                        formatFileSize(
                          material.size,
                        )}

                      {material.createdAt && (
                        <>
                          {material.size
                            ? " • "
                            : ""}

                          {new Date(
                            material.createdAt,
                          ).toLocaleDateString()}
                        </>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="material-selected">
                      <CheckCircle2 size={16} />
                      Selected
                    </span>
                  )}
                </button>

                <div className="material-card-footer">
                  <button
                    type="button"
                    className="material-use-button"
                    onClick={() =>
                      selectMaterial(material)
                    }
                  >
                    <BookOpen size={15} />
                    Use for study
                  </button>

                  <button
                    type="button"
                    className="material-delete-button"
                    onClick={() =>
                      handleDelete(material)
                    }
                    disabled={isDeleting}
                    title="Delete material"
                  >
                    {isDeleting ? (
                      <Loader2
                        size={16}
                        className="spin"
                      />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {showAddModal && (
        <div
          className="materials-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAddModal()
            }
          }}
        >
          <div className="materials-modal">
            <div className="materials-modal-header">
              <div>
                <p className="materials-eyebrow">
                  ADD MATERIAL
                </p>

                <h2>Add study material</h2>
              </div>

              <button
                type="button"
                className="materials-modal-close"
                onClick={closeAddModal}
                disabled={isSubmitting}
              >
                <X size={20} />
              </button>
            </div>

            <div className="materials-mode-switch">
              <button
                type="button"
                className={
                  addMode === "file"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setAddMode("file")
                }
              >
                <Upload size={17} />
                Upload file
              </button>

              <button
                type="button"
                className={
                  addMode === "text"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setAddMode("text")
                }
              >
                <ClipboardPaste size={17} />
                Paste text
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="materials-field">
                <span>Title</span>

                <input
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder="e.g. Biology Chapter 3"
                />
              </label>

              {addMode === "file" ? (
                <div className="materials-file-picker">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.doc,.docx"
                    onChange={
                      handleFileChange
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    <Upload size={21} />

                    <strong>
                      {selectedFile
                        ? selectedFile.name
                        : "Choose a file"}
                    </strong>

                    <span>
                      PDF, Word, or TXT • Max 20 MB
                    </span>
                  </button>
                </div>
              ) : (
                <label className="materials-field">
                  <span>Study material</span>

                  <textarea
                    value={textContent}
                    onChange={(event) =>
                      setTextContent(
                        event.target.value,
                      )
                    }
                    placeholder="Paste your notes, textbook content, lesson, or study material here..."
                    rows={10}
                  />
                </label>
              )}

              <div className="materials-modal-actions">
                <button
                  type="button"
                  className="materials-cancel-button"
                  onClick={closeAddModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="materials-submit-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2
                        size={17}
                        className="spin"
                      />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      Add material
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="materials-delete-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !deletingId
            ) {
              setDeleteTarget(null)
            }
          }}
        >
          <div className="materials-delete-modal">
            <div className="materials-delete-icon">
              <Trash2 size={22} />
            </div>

            <h2>Delete material?</h2>

            <p>
              Are you sure you want to delete{" "}
              <strong>
                "{deleteTarget.title}"
              </strong>
              ? This action cannot be undone.
            </p>

            <div className="materials-delete-actions">
              <button
                type="button"
                className="materials-delete-cancel"
                onClick={() =>
                  setDeleteTarget(null)
                }
                disabled={!!deletingId}
              >
                Cancel
              </button>

              <button
                type="button"
                className="materials-delete-confirm"
                onClick={confirmDelete}
                disabled={!!deletingId}
              >
                {deletingId ? (
                  <>
                    <Loader2
                      size={16}
                      className="spin"
                    />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Materials