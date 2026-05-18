import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSession } from "@/lib/auth"
import { updateFolder, deleteFolder } from "@/lib/folders"
import { db } from "@/lib/db"

const UpdateFolderSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    parentFolderId: z.string().nullable().optional(),
  })
  .refine((b) => b.name !== undefined || b.parentFolderId !== undefined, {
    message: "At least one of name or parentFolderId is required",
  })

async function hasCircularRef(
  folderId: string,
  newParentId: string
): Promise<boolean> {
  if (folderId === newParentId) return true

  let current: string | null = newParentId
  const visited = new Set<string>()

  while (current !== null) {
    if (visited.has(current)) break
    visited.add(current)
    if (current === folderId) return true

    const row: { parentFolderId: string | null } | null = await db.folder.findFirst({
      where: { id: current },
      select: { parentFolderId: true },
    })
    current = row?.parentFolderId ?? null
  }

  return false
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = UpdateFolderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { id } = await params

  if (parsed.data.parentFolderId !== undefined && parsed.data.parentFolderId !== null) {
    const circular = await hasCircularRef(id, parsed.data.parentFolderId)
    if (circular) {
      return NextResponse.json({ error: "Circular reference" }, { status: 422 })
    }
  }

  const folder = await updateFolder(id, session.user.id, {
    name: parsed.data.name,
    parentFolderId: parsed.data.parentFolderId,
  })

  if (!folder) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(folder)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const deleted = await deleteFolder(id, session.user.id)

  if (!deleted) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({})
}
