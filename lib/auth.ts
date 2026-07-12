import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import { resolveApiKey } from "@/lib/api-key"

/** A resolved caller — from a browser session or a bearer API key. */
export type Actor = { userId: string; source: "session" | "apikey" }

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

// RFC 7235: the scheme is case-insensitive.
const BEARER_RE = /^Bearer\s+/i

/**
 * Resolve a request to a single userId from EITHER a bearer API key OR the
 * session. When an `Authorization: Bearer` header is present it is authoritative:
 * an invalid key returns null (no silent fallthrough to the session).
 */
export async function resolveActor(req: Request): Promise<Actor | null> {
  const authz = req.headers.get("authorization")
  if (authz && BEARER_RE.test(authz)) {
    const raw = authz.replace(BEARER_RE, "").trim()
    const resolved = await resolveApiKey(raw)
    return resolved ? { userId: resolved.userId, source: "apikey" } : null
  }
  const session = await getSession()
  return session?.user?.id
    ? { userId: session.user.id, source: "session" }
    : null
}

export async function requireActor(req: Request): Promise<Actor> {
  const actor = await resolveActor(req)
  if (!actor) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return actor
}
