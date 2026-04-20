import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSession } from "@/lib/auth"
import { createDiagram, listDiagrams } from "@/lib/diagrams"

const CreateDiagramSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  data: z
    .object({
      elements: z.array(z.any()),
      appState: z.record(z.string(), z.any()).optional(),
      files: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
})

export async function POST(req: NextRequest) {
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
    body = {}
  }

  const parsed = CreateDiagramSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const diagram = await createDiagram(
    session.user.id,
    parsed.data.name,
    parsed.data.data as Parameters<typeof createDiagram>[2]
  )

  return NextResponse.json(diagram, { status: 201 })
}

export async function GET() {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const diagrams = await listDiagrams(session.user.id)
  return NextResponse.json(diagrams)
}
