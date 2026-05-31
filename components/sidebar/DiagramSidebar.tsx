"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DndContext } from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import { SidebarItem } from "./SidebarItem"
import { SidebarFolderItem } from "./SidebarFolderItem"
import { TagManager } from "./TagManager"
import { UserMenu } from "./UserMenu"
import { SearchInput } from "./SearchInput"
import { TagFilter } from "./TagFilter"
import type { TagSummary } from "@/lib/tags"
import {
  buildSidebarTree,
  isDescendant,
  type SidebarData,
  type FolderSummary,
  type FolderNode,
  type DiagramEntry,
} from "@/lib/sidebar-tree"

type Props = {
  initialData: SidebarData
  currentId: string
  userName: string
  initialTags?: TagSummary[]
}

function flattenFolders(nodes: FolderNode[]): FolderSummary[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, parentFolderId: n.parentFolderId },
    ...flattenFolders(n.children),
  ])
}

function collectDiagrams(nodes: FolderNode[]): DiagramEntry[] {
  return nodes.flatMap((n) => [...n.diagrams, ...collectDiagrams(n.children)])
}

export function DiagramSidebar({ initialData, currentId, userName, initialTags }: Props) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [width, setWidth] = useState(220)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(false)

  const [flatFolders, setFlatFolders] = useState<FolderSummary[]>(() =>
    flattenFolders(initialData.folders)
  )
  const [flatDiagrams, setFlatDiagrams] = useState<DiagramEntry[]>(() => [
    ...collectDiagrams(initialData.folders),
    ...initialData.rootDiagrams,
  ])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [pendingNewFolderId, setPendingNewFolderId] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [tags, setTags] = useState<TagSummary[]>(initialTags ?? [])
  const [tagManagerOpen, setTagManagerOpen] = useState(false)

  const tree = useMemo(
    () => buildSidebarTree(flatFolders, flatDiagrams),
    [flatFolders, flatDiagrams]
  )

  const isFiltering = Boolean(searchQuery.trim() || activeTagId)
  const filteredDiagrams = useMemo(() => {
    if (!isFiltering) return []
    const q = searchQuery.trim().toLowerCase()
    return flatDiagrams
      .filter(d => !q || d.name.toLowerCase().includes(q))
      .filter(d => {
        if (!activeTagId) return true
        return d.tags?.some(t => t.id === activeTagId) ?? false
      })
  }, [flatDiagrams, searchQuery, activeTagId])

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
    const storedExpanded = localStorage.getItem("schemr:sidebar:expanded")
    if (storedExpanded) {
      try {
        setExpandedFolders(new Set(JSON.parse(storedExpanded)))
      } catch {
        // ignore malformed stored value
      }
    }
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem("schemr:sidebar:collapsed", String(next))
  }

  function handleFolderToggle(id: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem("schemr:sidebar:expanded", JSON.stringify([...next]))
      return next
    })
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
      folderId: null,
    }
    setFlatDiagrams((prev) => [optimistic, ...prev])
    try {
      const res = await fetch("/api/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error("Failed")
      const diagram = await res.json()
      setFlatDiagrams((prev) =>
        prev.map((item) =>
          item.id === "__optimistic__"
            ? {
                id: diagram.id,
                name: diagram.name,
                updatedAt: diagram.updatedAt ?? optimistic.updatedAt,
                folderId: null,
              }
            : item
        )
      )
      router.push(`/diagrams/${diagram.id}`)
    } catch {
      setFlatDiagrams((prev) => prev.filter((item) => item.id !== "__optimistic__"))
      setCreateError(true)
    } finally {
      setCreating(false)
    }
  }

  async function handleFolderCreate() {
    const optimisticId = `__folder_opt_${Date.now()}__`
    setFlatFolders((prev) => [
      ...prev,
      { id: optimisticId, name: "New Folder", parentFolderId: null },
    ])
    setPendingNewFolderId(optimisticId)
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Folder" }),
      })
      if (!res.ok) throw new Error("Failed")
      const folder = await res.json()
      setFlatFolders((prev) =>
        prev.map((f) =>
          f.id === optimisticId
            ? { id: folder.id, name: folder.name, parentFolderId: null }
            : f
        )
      )
      setPendingNewFolderId(folder.id)
    } catch {
      setFlatFolders((prev) => prev.filter((f) => f.id !== optimisticId))
      setPendingNewFolderId(null)
    }
  }

  async function handleFolderRename(id: string, name: string) {
    const prev = flatFolders.find((f) => f.id === id)
    setFlatFolders((all) => all.map((f) => (f.id === id ? { ...f, name } : f)))
    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error("Failed")
    } catch {
      if (prev) {
        setFlatFolders((all) => all.map((f) => (f.id === id ? { ...f, name: prev.name } : f)))
      }
    }
  }

  async function handleFolderDelete(id: string) {
    const toRemove = new Set<string>()
    function markDescendants(folderId: string) {
      toRemove.add(folderId)
      flatFolders
        .filter((f) => f.parentFolderId === folderId)
        .forEach((f) => markDescendants(f.id))
    }
    markDescendants(id)
    setFlatFolders((prev) => prev.filter((f) => !toRemove.has(f.id)))
    setFlatDiagrams((prev) =>
      prev.map((d) => (d.folderId && toRemove.has(d.folderId) ? { ...d, folderId: null } : d))
    )
    if (pendingNewFolderId === id) setPendingNewFolderId(null)
    await fetch(`/api/folders/${id}`, { method: "DELETE" })
  }

  async function handleDiagramRename(id: string, name: string) {
    const prev = flatDiagrams.find((d) => d.id === id)
    setFlatDiagrams((all) => all.map((d) => (d.id === id ? { ...d, name } : d)))
    try {
      const res = await fetch(`/api/diagrams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error("Failed")
    } catch {
      if (prev) {
        setFlatDiagrams((all) => all.map((d) => (d.id === id ? { ...d, name: prev.name } : d)))
      }
    }
  }

  async function handleDiagramDelete(id: string) {
    const index = flatDiagrams.findIndex((d) => d.id === id)
    const nextItem = flatDiagrams.find((d) => d.id !== id) ?? null
    const nextId = nextItem?.id ?? null

    setFlatDiagrams((prev) => prev.filter((d) => d.id !== id))

    try {
      const res = await fetch(`/api/diagrams/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      if (id === currentId) {
        router.push(nextId ? `/diagrams/${nextId}` : "/")
      }
    } catch {
      setFlatDiagrams((prev) => {
        const next = [...prev]
        const allInitial = [
          ...collectDiagrams(initialData.folders),
          ...initialData.rootDiagrams,
        ]
        const restored = allInitial.find((d) => d.id === id)
        if (restored) next.splice(index, 0, restored)
        return next
      })
    }
  }

  async function handleCreateTag(name: string) {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error ?? "Failed to create tag")
    }
    const tag: TagSummary = await res.json()
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleDeleteTag(tagId: string) {
    const prevTags = tags
    const prevDiagrams = flatDiagrams
    setTags((prev) => prev.filter((t) => t.id !== tagId))
    setFlatDiagrams((prev) =>
      prev.map((d) => {
        if (!d.tags) return d
        return { ...d, tags: d.tags.filter((t) => t.id !== tagId) }
      })
    )
    try {
      const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
    } catch {
      setTags(prevTags)
      setFlatDiagrams(prevDiagrams)
    }
  }

  async function handleAssignTag(diagramId: string, tagId: string) {
    const tag = tags.find((t) => t.id === tagId)
    if (!tag) return
    const prevDiagrams = flatDiagrams
    setFlatDiagrams((prev) =>
      prev.map((d) => {
        if (d.id !== diagramId) return d
        const existing = d.tags ?? []
        if (existing.some((t) => t.id === tagId)) return d
        return { ...d, tags: [...existing, tag] }
      })
    )
    try {
      const res = await fetch(`/api/diagrams/${diagramId}/tags/${tagId}`, { method: "POST" })
      if (!res.ok) throw new Error("Failed")
    } catch {
      setFlatDiagrams(prevDiagrams)
    }
  }

  async function handleRemoveTag(diagramId: string, tagId: string) {
    const prevDiagrams = flatDiagrams
    setFlatDiagrams((prev) =>
      prev.map((d) => {
        if (d.id !== diagramId) return d
        return { ...d, tags: (d.tags ?? []).filter((t) => t.id !== tagId) }
      })
    )
    try {
      const res = await fetch(`/api/diagrams/${diagramId}/tags/${tagId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
    } catch {
      setFlatDiagrams(prevDiagrams)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeData = active.data.current as { type: string; id: string } | undefined
    const overData = over.data.current as { type: string; id: string } | undefined
    if (!activeData || !overData) return

    if (activeData.type === "diagram" && overData.type === "folder") {
      const diagramId = activeData.id
      const folderId = overData.id
      setFlatDiagrams((prev) =>
        prev.map((d) => (d.id === diagramId ? { ...d, folderId } : d))
      )
      await fetch(`/api/diagrams/${diagramId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      })
    }

    if (activeData.type === "folder" && overData.type === "folder") {
      const movingId = activeData.id
      const targetId = overData.id
      if (movingId === targetId) return
      if (isDescendant(flatFolders, movingId, targetId)) return
      setFlatFolders((prev) =>
        prev.map((f) => (f.id === movingId ? { ...f, parentFolderId: targetId } : f))
      )
      await fetch(`/api/folders/${movingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentFolderId: targetId }),
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
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <img src="/logo.svg" alt="schemr" className="flex-1 h-5 object-left object-contain px-1" />
        <button
          onClick={() => setTagManagerOpen(true)}
          className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Manage tags"
          title="Manage tags"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </button>
        <button
          onClick={handleFolderCreate}
          className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="New folder"
          title="New folder"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="New diagram"
          title="New diagram"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {tagManagerOpen && (
        <TagManager
          tags={tags}
          onCreate={handleCreateTag}
          onDelete={handleDeleteTag}
          onClose={() => setTagManagerOpen(false)}
        />
      )}

      {createError && (
        <p className="px-3 py-1 text-red-400 text-xs">Could not create diagram.</p>
      )}

      {!collapsed && <SearchInput value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery("")} />}
      {!collapsed && <TagFilter tags={tags} activeTagId={activeTagId} onSelect={setActiveTagId} />}

      {/* List */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-y-auto py-1 px-1">
          {isFiltering ? (
            filteredDiagrams.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-500">No diagrams match</div>
            ) : (
              <div>
                {filteredDiagrams.map(d => (
                  <SidebarItem
                    key={d.id}
                    id={d.id}
                    name={d.name}
                    isCurrent={d.id === currentId}
                    thumbnail={d.thumbnail}
                    onRename={handleDiagramRename}
                    onDelete={handleDiagramDelete}
                    tags={d.tags}
                    allTags={tags}
                    onTagAssign={(tagId) => handleAssignTag(d.id, tagId)}
                    onTagRemove={(tagId) => handleRemoveTag(d.id, tagId)}
                  />
                ))}
              </div>
            )
          ) : (
            <>
              {tree.folders.map((folder) => (
                <SidebarFolderItem
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  isExpanded={expandedFolders.has(folder.id)}
                  onToggle={handleFolderToggle}
                  onRename={handleFolderRename}
                  onDelete={handleFolderDelete}
                  onDiagramRename={handleDiagramRename}
                  onDiagramDelete={handleDiagramDelete}
                  onDiagramTagAssign={handleAssignTag}
                  onDiagramTagRemove={handleRemoveTag}
                  allTags={tags}
                  currentDiagramId={currentId}
                  initialMode={pendingNewFolderId === folder.id ? "renaming" : "idle"}
                />
              ))}
              {tree.rootDiagrams.map((item) => (
                <SidebarItem
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  isCurrent={item.id === currentId}
                  thumbnail={item.thumbnail}
                  onRename={handleDiagramRename}
                  onDelete={handleDiagramDelete}
                  tags={item.tags}
                  allTags={tags}
                  onTagAssign={(tagId) => handleAssignTag(item.id, tagId)}
                  onTagRemove={(tagId) => handleRemoveTag(item.id, tagId)}
                />
              ))}
            </>
          )}
        </div>
      </DndContext>

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
