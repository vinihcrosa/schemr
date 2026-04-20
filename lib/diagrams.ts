import { db } from "@/lib/db"
import { deserializeCanvas, EMPTY_DIAGRAM, type ExcalidrawState } from "@/lib/excalidraw"

export type DiagramSummary = {
  id: string
  name: string
  updatedAt: Date
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
      name: name ?? "Untitled",
      data: (data ?? EMPTY_DIAGRAM) as object,
    },
  })
  return {
    id: diagram.id,
    name: diagram.name,
    updatedAt: diagram.updatedAt,
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
    data: deserializeCanvas(diagram.data),
  }
}

export async function listDiagrams(userId: string): Promise<DiagramSummary[]> {
  const diagrams = await db.diagram.findMany({
    where: { userId },
    select: { id: true, name: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  })
  return diagrams
}

export async function deleteDiagram(id: string, userId: string): Promise<boolean> {
  const result = await db.diagram.deleteMany({ where: { id, userId } })
  return result.count > 0
}

export async function updateDiagram(
  id: string,
  userId: string,
  patch: { name?: string; data?: ExcalidrawState }
): Promise<DiagramDetail | null> {
  const result = await db.diagram.updateMany({
    where: { id, userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.data !== undefined ? { data: patch.data as object } : {}),
    },
  })
  if (result.count === 0) return null
  const diagram = await db.diagram.findFirst({ where: { id, userId } })
  if (!diagram) return null
  return {
    id: diagram.id,
    name: diagram.name,
    updatedAt: diagram.updatedAt,
    data: deserializeCanvas(diagram.data),
  }
}
