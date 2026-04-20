"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { SidebarItem } from "./SidebarItem"
import { UserMenu } from "./UserMenu"

type DiagramEntry = {
  id: string
  name: string
  updatedAt: string
}

type Props = {
  diagrams: DiagramEntry[]
  currentId: string
  userName: string
}

export function DiagramSidebar({ diagrams, currentId, userName }: Props) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [width, setWidth] = useState(220)
  const [items, setItems] = useState<DiagramEntry[]>(diagrams)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(false)

  const widthRef = useRef(width)
  useEffect(() => {
    widthRef.current = width
  }, [width])

  useEffect(() => {
    const storedCollapsed = localStorage.getItem("schemr:sidebar:collapsed")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedCollapsed !== null) setCollapsed(storedCollapsed === "true")
    const storedWidth = localStorage.getItem("schemr:sidebar:width")
    if (storedWidth !== null) setWidth(Number(storedWidth))
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem("schemr:sidebar:collapsed", String(next))
  }

  function startResize(e: React.MouseEvent) {
    const startX = e.clientX
    const startWidth = width

    function onMove(ev: MouseEvent) {
      const next = Math.max(180, startWidth + (ev.clientX - startX))
      setWidth(next)
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      localStorage.setItem("schemr:sidebar:width", String(widthRef.current))
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  async function handleCreate() {
    setCreating(true)
    setCreateError(false)
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, "0")
    const mm = String(now.getMinutes()).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    const mo = String(now.getMonth() + 1).padStart(2, "0")
    const aa = String(now.getFullYear()).slice(-2)
    const optimistic: DiagramEntry = {
      id: "__optimistic__",
      name: `${hh}-${mm}-${dd}-${mo}-${aa}`,
      updatedAt: now.toISOString(),
    }
    setItems((prev) => [optimistic, ...prev])
    try {
      const res = await fetch("/api/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error("Failed")
      const diagram = await res.json()
      setItems((prev) =>
        prev.map((item) =>
          item.id === "__optimistic__"
            ? { id: diagram.id, name: diagram.name, updatedAt: diagram.updatedAt ?? optimistic.updatedAt }
            : item
        )
      )
      router.push(`/diagrams/${diagram.id}`)
    } catch {
      setItems((prev) => prev.filter((item) => item.id !== "__optimistic__"))
      setCreateError(true)
    } finally {
      setCreating(false)
    }
  }

  async function handleRename(id: string, name: string) {
    const prev = items.find((item) => item.id === id)
    setItems((all) => all.map((item) => (item.id === id ? { ...item, name } : item)))
    try {
      const res = await fetch(`/api/diagrams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error("Failed")
    } catch {
      if (prev) {
        setItems((all) =>
          all.map((item) => (item.id === id ? { ...item, name: prev.name } : item))
        )
      }
    }
  }

  async function handleDelete(id: string) {
    const index = items.findIndex((item) => item.id === id)
    const nextItem = items.find((item) => item.id !== id) ?? null
    const nextId = nextItem?.id ?? null

    setItems((prev) => prev.filter((item) => item.id !== id))

    try {
      const res = await fetch(`/api/diagrams/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      if (id === currentId) {
        router.push(nextId ? `/diagrams/${nextId}` : "/")
      }
    } catch {
      setItems((prev) => {
        const next = [...prev]
        const restored = diagrams.find((d) => d.id === id)
        if (restored) next.splice(index, 0, restored)
        return next
      })
    }
  }

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-3 gap-3 bg-zinc-900 border-r border-zinc-800"
        style={{ width: 40, minWidth: 40 }}
        data-testid="sidebar-collapsed"
      >
        <button
          onClick={toggleCollapsed}
          className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Expand sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <div className="mt-auto">
          <UserMenu name={userName} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative flex flex-col bg-zinc-900 border-r border-zinc-800 h-full"
      style={{ width, minWidth: width }}
      data-testid="sidebar-expanded"
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-zinc-800">
        <button
          onClick={toggleCollapsed}
          className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Collapse sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="flex-1 text-zinc-300 text-xs font-medium px-1">Schemr</span>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="New diagram"
          title="New diagram"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {createError && (
        <p className="px-3 py-1 text-red-400 text-xs">Could not create diagram.</p>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {items.map((item) => (
          <SidebarItem
            key={item.id}
            id={item.id}
            name={item.name}
            isCurrent={item.id === currentId}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-zinc-800">
        <UserMenu name={userName} />
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={startResize}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-zinc-600 transition-colors"
        data-testid="resize-handle"
        aria-hidden="true"
      />
    </div>
  )
}
