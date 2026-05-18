"use client"

import { useState, useRef, useEffect } from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { SidebarItem } from "./SidebarItem"
import type { FolderNode } from "@/lib/sidebar-tree"

type FolderMode = "idle" | "renaming" | "delete-pending"

type Props = {
  folder: FolderNode
  depth: number
  isExpanded: boolean
  onToggle: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  currentDiagramId: string
}

export function SidebarFolderItem({
  folder,
  depth,
  isExpanded,
  onToggle,
  onRename,
  onDelete,
  currentDiagramId,
}: Props) {
  const [mode, setMode] = useState<FolderMode>("idle")
  const [editValue, setEditValue] = useState(folder.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `folder-${folder.id}`,
    data: { type: "folder", id: folder.id },
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: { type: "folder", id: folder.id },
  })

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
    setEditValue(folder.name)
    setMode("renaming")
  }

  function commitRename() {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === folder.name) {
      setEditValue(folder.name)
      setMode("idle")
      return
    }
    onRename(folder.id, trimmed)
    setMode("idle")
  }

  function cancelRename() {
    setEditValue(folder.name)
    setMode("idle")
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename()
    if (e.key === "Escape") cancelRename()
  }

  function handleFirstDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    setMode("delete-pending")
    deleteTimeoutRef.current = setTimeout(() => setMode("idle"), 3000)
  }

  function handleSecondDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    onDelete(folder.id)
    setMode("idle")
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    setMode("idle")
  }

  const indent = depth * 12

  if (mode === "renaming") {
    return (
      <div>
        <div className="px-2 py-1.5" style={{ paddingLeft: indent + 8 }}>
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={cancelRename}
            className="w-full bg-zinc-700 text-zinc-100 text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-zinc-400"
            aria-label="Rename folder"
          />
        </div>
      </div>
    )
  }

  if (mode === "delete-pending") {
    return (
      <div>
        <div className="group flex items-center gap-1 px-2 py-1.5 rounded-md bg-red-950/40 border border-red-900/50" style={{ marginLeft: indent }}>
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
          >
            Delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        ref={setDropRef}
        data-testid="folder-row"
        style={{ paddingLeft: indent }}
        className={[
          "group flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors",
          isOver
            ? "bg-zinc-600 text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
          isDragging ? "opacity-40" : "",
        ].join(" ")}
        onClick={() => onToggle(folder.id)}
      >
        {/* drag handle — listeners isolated here so they don't block clicks on the row */}
        <span
          ref={setDragRef}
          {...listeners}
          {...attributes}
          className="shrink-0 cursor-grab text-zinc-600 hover:text-zinc-400 px-0.5"
          aria-label="Drag folder"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="flex-1 truncate" title={folder.name}>
          {folder.name}
        </span>
        <button
          onClick={startRename}
          className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 text-zinc-500 hover:text-zinc-300 transition-opacity"
          aria-label={`Rename ${folder.name}`}
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
          aria-label={`Delete ${folder.name}`}
          tabIndex={-1}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div>
          {folder.children.map((child) => (
            <SidebarFolderItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              isExpanded={false}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
              currentDiagramId={currentDiagramId}
            />
          ))}
          {folder.diagrams.map((d) => (
            <div key={d.id} style={{ paddingLeft: (depth + 1) * 12 }}>
              <SidebarItem
                id={d.id}
                name={d.name}
                isCurrent={d.id === currentDiagramId}
                onRename={() => {}}
                onDelete={() => {}}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
