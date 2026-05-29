"use client"
import { useEffect, useRef } from "react"
import type { TagSummary } from "@/lib/tags"

type Props = {
  availableTags: TagSummary[]
  assignedTagIds: string[]
  onAssign: (tagId: string) => Promise<void>
  onRemove: (tagId: string) => Promise<void>
  onClose: () => void
}

export function TagPicker({
  availableTags,
  assignedTagIds,
  onAssign,
  onRemove,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [onClose])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Tag picker"
      className="absolute z-50 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
    >
      {availableTags.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-500">
          No tags yet. Create one in Manage Tags.
        </p>
      ) : (
        <ul>
          {availableTags.map((tag) => {
            const isAssigned = assignedTagIds.includes(tag.id)
            return (
              <li key={tag.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isAssigned}
                  onClick={() => (isAssigned ? onRemove(tag.id) : onAssign(tag.id))}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 ${
                    isAssigned ? "text-indigo-700 font-medium" : "text-slate-700"
                  }`}
                >
                  {isAssigned && (
                    <span aria-hidden="true" className="text-indigo-600">
                      ✓
                    </span>
                  )}
                  {tag.name}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
