import { NextRequest, NextResponse } from "next/server"
import { getDiagramByShareToken } from "@/lib/diagrams"

// Public, unauthenticated. Returns only { name, data } for a valid share token,
// or 404 for missing / revoked / malformed tokens. Never a redirect.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const shared = await getDiagramByShareToken(token)
  if (!shared) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(shared)
}
