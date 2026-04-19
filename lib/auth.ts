import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { Session } from "next-auth"

export async function getSession(): Promise<Session | null> {
  return auth()
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return session
}
