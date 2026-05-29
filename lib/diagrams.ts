import { db } from "@/lib/db"
import { deserializeCanvas, EMPTY_DIAGRAM, type ExcalidrawState } from "@/lib/excalidraw"
import type { TagSummary } from "@/lib/tags"

function defaultDiagramName(): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const mo = String(now.getMonth() + 1).padStart(2, "0")
  const aa = String(now.getFullYear()).slice(-2)
  return `${hh}-${mm}-${dd}-${mo}-${aa}`
}

export type DiagramSummary = {
  id: string
  name: string
  updatedAt: Date
  folderId: string | null
  thumbnail: string | null
  tags: TagSummary[]
}

export type DiagramDetail = DiagramSummary & {
  data: ExcalidrawState
}

export async function createDiagram(
  userId: string,
  name?: string,
  data?: ExcalidrawState
): Promise<DiagramDetail> {
  const diagram = await db.diagram.create({
    data: {
      userId,
      name: name ?? defaultDiagramName(),
      data: (data ?? EMPTY_DIAGRAM) as object,
    },
  })
  return {
    id: diagram.id,
    name: diagram.name,
    updatedAt: diagram.updatedAt,
    folderId: diagram.folderId ?? null,
    thumbnail: diagram.thumbnail ?? null,
    tags: [],
    data: deserializeCanvas(diagram.data),
  }
}

export async function getDiagramById(
  id: string,
  userId: string
): Promise<DiagramDetail | null> {
  const diagram = await db.diagram.findFirst({
    where: { id, userId },
  })
  if (!diagram) return null
  return {
    id: diagram.id,
    name: diagram.name,
    updatedAt: diagram.updatedAt,
    folderId: diagram.folderId ?? null,
    thumbnail: diagram.thumbnail ?? null,
    tags: [],
    data: deserializeCanvas(diagram.data),
  }
}

export async function listDiagrams(userId: string): Promise<DiagramSummary[]> {
  const diagrams = await db.diagram.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      folderId: true,
      thumbnail: true,
      tags: {
        select: {
          tag: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { updatedAt: "desc" },
  })
  return diagrams.map(({ tags, thumbnail, ...rest }) => ({
    ...rest,
    thumbnail: thumbnail ?? null,
    tags: (tags as Array<{ tag: { id: string; name: string } }>).map((dt) => dt.tag),
  }))
}

export async function deleteDiagram(id: string, userId: string): Promise<boolean> {
  const result = await db.diagram.deleteMany({ where: { id, userId } })
  return result.count > 0
}

export async function updateDiagram(
  id: string,
  userId: string,
  patch: { name?: string; data?: ExcalidrawState; folderId?: string | null; thumbnail?: string | null }
): Promise<DiagramDetail | null> {
  const result = await db.diagram.updateMany({
    where: { id, userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.data !== undefined ? { data: patch.data as object } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
      ...(patch.thumbnail !== undefined ? { thumbnail: patch.thumbnail } : {}),
    },
  })
  if (result.count === 0) return null
  const diagram = await db.diagram.findFirst({ where: { id, userId } })
  if (!diagram) return null
  return {
    id: diagram.id,
    name: diagram.name,
    updatedAt: diagram.updatedAt,
    folderId: diagram.folderId ?? null,
    thumbnail: diagram.thumbnail ?? null,
    tags: [],
    data: deserializeCanvas(diagram.data),
  }
}
