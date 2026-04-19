import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = registerSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { email, name, password } = result.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    )
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: { email, name, password: hashed },
  })

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}
