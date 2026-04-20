import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSession } from "@/lib/auth"
import { getDiagramById, updateDiagram, deleteDiagram } from "@/lib/diagrams"

const UpdateDiagramSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    data: z
      .object({
        elements: z.array(z.any()),
        appState: z.record(z.string(), z.any()).optional(),
        files: z.record(z.string(), z.any()).optional(),
      })
      .optional(),
  })
  .refine((body) => body.name !== undefined || body.data !== undefined, {
    message: "At least one of name or data is required",
  })

export async function GET(
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
  const diagram = await getDiagramById(id, session.user.id)
  if (!diagram) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(diagram)
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

  const parsed = UpdateDiagramSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { id } = await params
  const diagram = await updateDiagram(id, session.user.id, {
    name: parsed.data.name,
    data: parsed.data.data as Parameters<typeof updateDiagram>[2]["data"],
  })

  if (!diagram) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(diagram)
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
  const deleted = await deleteDiagram(id, session.user.id)

  if (!deleted) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({})
}
