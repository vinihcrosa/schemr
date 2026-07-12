import { randomBytes } from "node:crypto"
import { db } from "@/lib/db"
import { deserializeCanvas, EMPTY_DIAGRAM, type ExcalidrawState } from "@/lib/excalidraw"
import type { TagSummary } from "@/lib/tags"

// Default diagram title per DESIGN.md ("Untitled"). Users rename inline.
function defaultDiagramName(): string {
  return "Untitled"
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
  shareToken: string | null
}

// Public share payload — deliberately minimal. Never widen this: exposing
// userId / relations here would leak owner data on the unauthenticated route.
export type SharedDiagram = {
  name: string
  data: ExcalidrawState
}

function generateShareToken(): string {
  return randomBytes(16).toString("base64url")
}

export async function createDiagram(
  userId: string,
  name?: string,
  data?: ExcalidrawState,
  folderId?: string | null
): Promise<DiagramDetail> {
  const diagram = await db.diagram.create({
    data: {
      userId,
      name: name ?? defaultDiagramName(),
      data: (data ?? EMPTY_DIAGRAM) as object,
      ...(folderId != null ? { folderId } : {}),
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
    shareToken: diagram.shareToken ?? null,
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
    shareToken: diagram.shareToken ?? null,
  }
}

// Mint a share token if absent; idempotent — returns the existing token when
// already shared. Ownership-scoped: returns null if the diagram isn't owned by
// userId. Retries on the (astronomically unlikely) unique-collision.
export async function shareDiagram(
  id: string,
  userId: string
): Promise<{ shareToken: string } | null> {
  const existing = await db.diagram.findFirst({
    where: { id, userId },
    select: { shareToken: true },
  })
  if (!existing) return null
  if (existing.shareToken) return { shareToken: existing.shareToken }

  for (let attempt = 0; attempt < 3; attempt++) {
    const token = generateShareToken()
    try {
      const result = await db.diagram.updateMany({
        where: { id, userId },
        data: { shareToken: token },
      })
      if (result.count === 0) return null
      return { shareToken: token }
    } catch (err) {
      // P2002 = unique constraint violation on shareToken → retry with a new token
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        continue
      }
      throw err
    }
  }
  return null
}

// Clear the share token (revoke). Returns false if the diagram isn't owned.
export async function unshareDiagram(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db.diagram.updateMany({
    where: { id, userId },
    data: { shareToken: null },
  })
  return result.count > 0
}

// Public lookup by share token — selects ONLY name + data. No userId, no
// relations. Returns null for missing / revoked tokens.
export async function getDiagramByShareToken(
  token: string
): Promise<SharedDiagram | null> {
  const diagram = await db.diagram.findUnique({
    where: { shareToken: token },
    select: { name: true, data: true },
  })
  if (!diagram) return null
  return {
    name: diagram.name,
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
    shareToken: diagram.shareToken ?? null,
  }
}
