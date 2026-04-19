import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true },
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(user)
}
