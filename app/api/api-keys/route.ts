import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSession } from "@/lib/auth"
import { createApiKey, listApiKeys } from "@/lib/api-key"

// Key management is session-only: a bearer API key must never mint more keys.
const CreateApiKeySchema = z.object({
  label: z.string().min(1).max(80).optional(),
})

export async function GET() {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const keys = await listApiKeys(session.user.id)
  return NextResponse.json(keys)
}

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

  const parsed = CreateApiKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const created = await createApiKey(session.user.id, parsed.data.label)
  // Expose the raw secret as `key` — the only time it is ever returned.
  return NextResponse.json(
    {
      id: created.id,
      key: created.raw,
      prefix: created.prefix,
      label: created.label,
      scopes: created.scopes,
    },
    { status: 201 }
  )
}
