"use client"
import { useState } from "react"
import type { TagSummary } from "@/lib/tags"

type Props = {
  tags: TagSummary[]
  onCreate: (name: string) => Promise<void>
  onDelete: (tagId: string) => Promise<void>
  onClose: () => void
}

export function TagManager({ tags, onCreate, onDelete, onClose }: Props) {
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    const trimmed = input.trim()
    if (!trimmed) {
      setError("Tag name required")
      return
    }
    if (trimmed.length > 32) {
      setError("Max 32 characters")
      return
    }
    setLoading(true)
    try {
      await onCreate(trimmed)
      setInput("")
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tag")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleCreate()
    }
  }

  async function handleConfirmDelete(tagId: string) {
    await onDelete(tagId)
    setDeletingId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2>Manage Tags</h2>
        <button type="button" onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>

      <div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New tag name"
          aria-label="New tag name"
        />
        <button type="button" onClick={handleCreate} disabled={loading}>
          {loading ? "Creating..." : "Create"}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>

      <ul>
        {tags.map((tag) => (
          <li key={tag.id}>
            <span>{tag.name}</span>
            {deletingId === tag.id ? (
              <>
                <button
                  type="button"
                  onClick={() => handleConfirmDelete(tag.id)}
                  aria-label={`Confirm delete ${tag.name}`}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  aria-label={`Cancel delete ${tag.name}`}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setDeletingId(tag.id)}
                aria-label={`Delete ${tag.name}`}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
