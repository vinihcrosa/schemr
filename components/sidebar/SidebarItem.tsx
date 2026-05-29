"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDraggable } from "@dnd-kit/core"
import { TagChip } from "./TagChip"
import { TagPicker } from "./TagPicker"
import type { TagSummary } from "@/lib/tags"

type ItemMode = "idle" | "renaming" | "delete-pending"

type Props = {
  id: string
  name: string
  isCurrent: boolean
  thumbnail?: string | null
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  tags?: TagSummary[]
  allTags?: TagSummary[]
  onTagAssign?: (tagId: string) => Promise<void>
  onTagRemove?: (tagId: string) => Promise<void>
}

export function SidebarItem({ id, name, isCurrent, thumbnail, onRename, onDelete, tags, allTags, onTagAssign, onTagRemove }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<ItemMode>("idle")
  const [editValue, setEditValue] = useState(name)
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [thumbPos, setThumbPos] = useState<{ top: number; left: number } | null>(null)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `diagram-${id}`,
    data: { type: "diagram", id },
  })
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMouseEnter() {
    if (!thumbnail || !rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    setThumbPos({ top: rect.top, left: rect.right + 8 })
  }

  function handleMouseLeave() {
    setThumbPos(null)
  }

  useEffect(() => {
    if (mode === "renaming") {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [mode])

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    }
  }, [])

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

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename()
    if (e.key === "Escape") cancelRename()
  }

  function handleFirstDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    setMode("delete-pending")
    deleteTimeoutRef.current = setTimeout(() => {
      setMode("idle")
    }, 3000)
  }

  function handleSecondDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    onDelete(id)
    setMode("idle")
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    setMode("idle")
  }

  function handleRowClick() {
    if (isCurrent || mode !== "idle") return
    router.push(`/diagrams/${id}`)
  }

  if (mode === "renaming") {
    return (
      <div className="px-2 py-1.5">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={cancelRename}
          className="w-full bg-zinc-700 text-zinc-100 text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-zinc-400"
          aria-label="Rename diagram"
        />
      </div>
    )
  }

  if (mode === "delete-pending") {
    return (
      <div className="group flex items-center gap-1 px-2 py-1.5 rounded-md bg-red-950/40 border border-red-900/50">
        <span className="flex-1 text-zinc-400 text-xs truncate">Delete?</span>
        <button
          onClick={handleCancelDelete}
          className="text-zinc-500 hover:text-zinc-300 text-xs px-1"
          aria-label="Cancel delete"
        >
          No
        </button>
        <button
          onClick={handleSecondDeleteClick}
          className="text-red-400 hover:text-red-300 text-xs px-1 font-medium"
          aria-label="Confirm delete"
          title="Click again to delete"
        >
          Delete
        </button>
      </div>
    )
  }

  return (
    <>
      <div
        ref={rowRef}
        onClick={handleRowClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role={isCurrent ? undefined : "button"}
        tabIndex={isCurrent ? undefined : 0}
        onKeyDown={(e) => { if (e.key === "Enter") handleRowClick() }}
        className={[
          "group flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors",
          isCurrent
            ? "bg-zinc-700 text-zinc-100 font-medium cursor-default"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer",
          isDragging ? "opacity-40" : "",
        ].join(" ")}
        aria-current={isCurrent ? "page" : undefined}
      >
        <span
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          className="opacity-0 group-hover:opacity-100 shrink-0 cursor-grab text-zinc-600 hover:text-zinc-400 px-0.5 select-none"
          aria-label="Drag diagram"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>
        <span className="flex-1 truncate" title={name}>
          {name}
        </span>
        <button
          onClick={startRename}
          className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 text-zinc-500 hover:text-zinc-300 transition-opacity"
          aria-label={`Rename ${name}`}
          tabIndex={-1}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          onClick={handleFirstDeleteClick}
          className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 text-zinc-500 hover:text-red-400 transition-opacity"
          aria-label={`Delete ${name}`}
          tabIndex={-1}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>

        {thumbPos && thumbnail && (
          <div
            style={{ position: "fixed", top: thumbPos.top, left: thumbPos.left, zIndex: 9999, pointerEvents: "none" }}
            className="bg-zinc-800 border border-zinc-600 rounded-md shadow-xl overflow-hidden"
          >
            <img src={thumbnail} alt={name} className="w-48 h-auto block" />
          </div>
        )}
      </div>

      {isCurrent && (
        <div className="flex flex-wrap gap-1 px-2 pb-1">
          {(tags ?? []).map(tag => (
            <TagChip key={tag.id} name={tag.name} onRemove={() => onTagRemove?.(tag.id)} />
          ))}
          {(allTags ?? []).length > 0 ? (
            <button
              onClick={() => setPickerOpen(true)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              + Add tag
            </button>
          ) : (
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>No tags yet</span>
          )}
          {pickerOpen && (
            <TagPicker
              availableTags={allTags ?? []}
              assignedTagIds={(tags ?? []).map(t => t.id)}
              onAssign={async (id) => { await onTagAssign?.(id) }}
              onRemove={async (id) => { await onTagRemove?.(id) }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
      )}
    </>
  )
}
