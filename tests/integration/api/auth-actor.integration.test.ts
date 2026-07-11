import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { Session } from "next-auth"
import { db } from "@/lib/db"
import { createApiKey, revokeApiKey } from "@/lib/api-key"

const TEST_EMAIL_DOMAIN = "@auth-actor-test.example"

// Controllable session for the session branch of resolveActor.
let mockSession: Session | null = null
vi.mock("@/auth", () => ({
  auth: async () => mockSession,
}))

// Import AFTER the mock so lib/auth's `auth` binding is the mocked one.
async function getAuth() {
  return import("@/lib/auth")
}

let userId: string

function bearer(raw: string): Request {
  return new Request("http://localhost/api/diagrams", {
    headers: { authorization: `Bearer ${raw}` },
  })
}

const noHeader = () => new Request("http://localhost/api/diagrams")

beforeEach(async () => {
  mockSession = null
  const ts = Date.now()
  userId = (
    await db.user.create({
      data: { email: `u_${ts}${TEST_EMAIL_DOMAIN}`, password: "h" },
      select: { id: true },
    })
  ).id
})

afterEach(async () => {
  mockSession = null
  await db.user.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
})

describe("resolveActor — bearer branch", () => {
  it("resolves a valid bearer key to an apikey actor", async () => {
    const { resolveActor } = await getAuth()
    const { raw } = await createApiKey(userId)
    expect(await resolveActor(bearer(raw))).toEqual({ userId, source: "apikey" })
  })

  it("returns null for a revoked key (no session fallthrough)", async () => {
    const { resolveActor } = await getAuth()
    const { id, raw } = await createApiKey(userId)
    await revokeApiKey(id, userId)
    mockSession = { user: { id: "someone" } } as Session // present but must be ignored
    expect(await resolveActor(bearer(raw))).toBeNull()
  })

  it("returns null for an unknown key", async () => {
    const { resolveActor } = await getAuth()
    expect(await resolveActor(bearer("sk_" + "x".repeat(43)))).toBeNull()
  })

  it("returns null for an empty bearer value", async () => {
    const { resolveActor } = await getAuth()
    expect(await resolveActor(bearer(""))).toBeNull()
  })
})

describe("resolveActor — session branch", () => {
  it("resolves a session to a session actor when no bearer header", async () => {
    const { resolveActor } = await getAuth()
    mockSession = { user: { id: userId } } as Session
    expect(await resolveActor(noHeader())).toEqual({ userId, source: "session" })
  })

  it("returns null when neither bearer nor session present", async () => {
    const { resolveActor } = await getAuth()
    expect(await resolveActor(noHeader())).toBeNull()
  })
})

describe("requireActor", () => {
  it("returns the actor when resolvable", async () => {
    const { requireActor } = await getAuth()
    const { raw } = await createApiKey(userId)
    const actor = await requireActor(bearer(raw))
    expect(actor.userId).toBe(userId)
  })

  it("throws a 401 Response when unresolvable", async () => {
    const { requireActor } = await getAuth()
    try {
      await requireActor(noHeader())
      expect.unreachable("should have thrown")
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Response)
      expect((thrown as Response).status).toBe(401)
    }
  })
})
