"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"

type RowMode = "idle" | "renaming" | "confirm-delete"

type Props = {
  id: string
  name: string
  updatedAt: string
  onRename: (id: string, newName: string) => void
  onDelete: (id: string) => void
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function DiagramRow({ id, name, updatedAt, onRename, onDelete }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<RowMode>("idle")
  const [editValue, setEditValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode === "renaming") {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [mode])

  function startRename(e: React.MouseEvent) {
    e.stopPropagation()
    setEditValue(name)
    setMode("renaming")
  }

  function commitRename() {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === name) {
      setEditValue(name)
      setMode("idle")
      return
    }
    onRename(id, trimmed)
    setMode("idle")
  }

  function cancelRename() {
    setEditValue(name)
    setMode("idle")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename()
    if (e.key === "Escape") cancelRename()
  }

  function handleRowClick() {
    if (mode !== "idle") return
    router.push(`/diagrams/${id}`)
  }

  if (mode === "renaming") {
    return (
      <li className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={cancelRename}
          className="flex-1 bg-transparent text-zinc-100 text-sm outline-none border-b border-zinc-500 focus:border-zinc-300 pb-0.5"
          aria-label="Rename diagram"
        />
        <span className="text-zinc-600 text-xs">Enter to save · Esc to cancel</span>
      </li>
    )
  }

  if (mode === "confirm-delete") {
    return (
      <li className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-900 border border-red-900">
        <span className="flex-1 text-zinc-300 text-sm truncate">
          Delete <span className="font-medium text-zinc-100">&ldquo;{name}&rdquo;</span>? This cannot be undone.
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setMode("idle") }}
          className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1"
        >
          Cancel
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(id); setMode("idle") }}
          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 font-medium"
        >
          Delete
        </button>
      </li>
    )
  }

  return (
    <li className="group flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <button
        onClick={handleRowClick}
        className="flex-1 text-left text-zinc-100 text-sm font-medium truncate hover:text-white cursor-pointer"
        aria-label={`Open ${name}`}
      >
        {name}
      </button>
      <span className="text-zinc-500 text-xs shrink-0">{formatUpdatedAt(updatedAt)}</span>
      <button
        onClick={startRename}
        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 transition-opacity p-1"
        aria-label={`Rename ${name}`}
        title="Rename"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setMode("confirm-delete") }}
        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity p-1"
        aria-label={`Delete ${name}`}
        title="Delete"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </li>
  )
}
