import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { assignTag, removeTag } from "@/lib/tags"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: diagramId, tagId } = await params

  try {
    await assignTag(session.user.id, diagramId, tagId)
    return NextResponse.json({}, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: diagramId, tagId } = await params

  try {
    await removeTag(session.user.id, diagramId, tagId)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
