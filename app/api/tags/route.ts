import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { requireSession } from "@/lib/auth"
import { listTags, createTag } from "@/lib/tags"

const CreateTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name required")
    .max(32, "Max 32 characters")
    .trim(),
})

export async function GET() {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tags = await listTags(session.user.id)
  return NextResponse.json(tags)
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

  const parsed = CreateTagSchema.safeParse(body)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid request body"
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  try {
    const tag = await createTag(session.user.id, parsed.data.name)
    return NextResponse.json(tag, { status: 201 })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ error: "Tag already exists" }, { status: 409 })
    }
    throw err
  }
}
