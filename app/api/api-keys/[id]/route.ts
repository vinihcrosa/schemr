import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { revokeApiKey } from "@/lib/api-key"

// Session-only, like the collection route — a bearer key cannot revoke keys.
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
  const revoked = await revokeApiKey(id, session.user.id)
  if (!revoked) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return new NextResponse(null, { status: 204 })
}
