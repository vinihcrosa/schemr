"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function CreateFirstDiagramButton() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error("Failed")
      const diagram = await res.json()
      router.push(`/diagrams/${diagram.id}`)
    } catch {
      setError("Could not create diagram. Try again.")
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleCreate}
        disabled={creating}
        className="px-5 py-2.5 bg-zinc-100 text-zinc-900 text-sm font-medium rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {creating ? "Creating…" : "Create your first diagram"}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  )
}
