"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DiagramRow } from "./DiagramRow"

type DiagramItem = {
  id: string
  name: string
  updatedAt: string
}

type Props = {
  diagrams: DiagramItem[]
}

export function DiagramList({ diagrams }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<DiagramItem[]>(diagrams)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCreate() {
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error("Failed to create")
      const diagram = await res.json()
      router.push(`/diagrams/${diagram.id}`)
    } catch {
      setCreateError("Could not create diagram. Please try again.")
      setCreating(false)
    }
  }

  async function handleRename(id: string, newName: string) {
    const prevItems = items
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: newName } : item))
    )
    try {
      const res = await fetch(`/api/diagrams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error("Failed to rename")
    } catch {
      setItems(prevItems)
    }
  }

  async function handleDelete(id: string) {
    const prevItems = items
    const removedIndex = items.findIndex((item) => item.id === id)
    setItems((prev) => prev.filter((item) => item.id !== id))
    try {
      const res = await fetch(`/api/diagrams/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
    } catch {
      setItems(prevItems.slice(0, removedIndex).concat(prevItems[removedIndex], prevItems.slice(removedIndex + 1)))
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-zinc-100 text-xl font-semibold">Your Diagrams</h1>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 text-sm font-medium rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creating…" : "New Diagram"}
          </button>
          {createError && (
            <span className="text-red-400 text-xs">{createError}</span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <p className="text-zinc-500 text-sm">No diagrams yet.</p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-5 py-2.5 bg-zinc-100 text-zinc-900 text-sm font-medium rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creating…" : "Create your first diagram"}
          </button>
          {createError && (
            <span className="text-red-400 text-xs">{createError}</span>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <DiagramRow
              key={item.id}
              id={item.id}
              name={item.name}
              updatedAt={item.updatedAt}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
