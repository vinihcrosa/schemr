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
    <div className="bg-zinc-800 border-b border-zinc-700 px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-medium text-zinc-300">Manage Tags</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-xs text-zinc-400 hover:text-zinc-200">
          Close
        </button>
      </div>

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New tag name"
          aria-label="New tag name"
          className="flex-1 text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="shrink-0 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2 py-1 rounded disabled:opacity-50"
        >
          {loading ? "Creating..." : "Add tag"}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-400 mb-2">{error}</p>}

      <ul className="space-y-1">
        {tags.map((tag) => (
          <li key={tag.id} className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-300 truncate">{tag.name}</span>
            {deletingId === tag.id ? (
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleConfirmDelete(tag.id)}
                  aria-label={`Confirm delete ${tag.name}`}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  aria-label={`Cancel delete ${tag.name}`}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDeletingId(tag.id)}
                aria-label={`Delete ${tag.name}`}
                className="shrink-0 text-xs text-zinc-500 hover:text-red-400"
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
