import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireActor } from "@/lib/auth"
import { db } from "@/lib/db"
import { createDiagram } from "@/lib/diagrams"
import { specToExcalidraw, SpecParseError } from "@/lib/spec-to-excalidraw"

const FromSpecSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  folderId: z.string().optional(),
  spec: z.string().min(1),
  format: z.literal("mermaid"),
})

export async function POST(req: NextRequest) {
  let actor
  try {
    actor = await requireActor(req)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const parsed = FromSpecSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { name, folderId, spec, format } = parsed.data

  // Owner-scope the folder before attaching — never write into another user's
  // folder namespace (machine-facing route).
  if (folderId != null) {
    const folder = await db.folder.findFirst({
      where: { id: folderId, userId: actor.userId },
      select: { id: true },
    })
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 400 })
    }
  }

  let data
  try {
    data = await specToExcalidraw(spec, format)
  } catch (err) {
    if (err instanceof SpecParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const diagram = await createDiagram(actor.userId, name, data, folderId ?? null)
  return NextResponse.json(diagram, { status: 201 })
}
