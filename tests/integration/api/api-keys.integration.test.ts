import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createApiKey, resolveApiKey } from "@/lib/api-key"

// Real requireSession — session driven by mocking @/auth. This lets us assert
// that a bearer key is rejected by the (session-only) key-management routes.
let mockSession: { user: { id: string } } | null = null
vi.mock("@/auth", () => ({
  auth: async () => mockSession,
}))

const TEST_EMAIL_DOMAIN = "@api-keys-route-test.example"

let userA: string
let userB: string

async function collection() {
  return import("@/app/api/api-keys/route")
}
async function member() {
  return import("@/app/api/api-keys/[id]/route")
}

function req(
  method: string,
  opts: { body?: unknown; bearer?: string } = {}
): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (opts.bearer !== undefined) headers.authorization = `Bearer ${opts.bearer}`
  return new NextRequest("http://localhost/api/api-keys", {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
}

beforeEach(async () => {
  mockSession = null
  const ts = Date.now()
  userA = (
    await db.user.create({
      data: { email: `a_${ts}${TEST_EMAIL_DOMAIN}`, password: "h" },
      select: { id: true },
    })
  ).id
  userB = (
    await db.user.create({
      data: { email: `b_${ts}${TEST_EMAIL_DOMAIN}`, password: "h" },
      select: { id: true },
    })
  ).id
})

afterEach(async () => {
  mockSession = null
  await db.user.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
})

describe("POST /api/api-keys", () => {
  it("mints a key and returns the raw secret once", async () => {
    const { POST } = await collection()
    mockSession = { user: { id: userA } }
    const res = await POST(req("POST", { body: { label: "CI" } }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.key.startsWith("sk_")).toBe(true)
    expect(body.label).toBe("CI")
    expect(body).not.toHaveProperty("hashedKey")
  })

  it("takes userId from session, not the request", async () => {
    const { POST } = await collection()
    mockSession = { user: { id: userA } }
    const res = await POST(req("POST", { body: { userId: userB } }))
    const { id } = await res.json()
    const row = await db.apiKey.findUnique({ where: { id } })
    expect(row!.userId).toBe(userA)
  })

  it("returns 400 for an invalid label", async () => {
    const { POST } = await collection()
    mockSession = { user: { id: userA } }
    const res = await POST(req("POST", { body: { label: "a".repeat(81) } }))
    expect(res.status).toBe(400)
  })

  it("returns 401 for an unauthenticated request", async () => {
    const { POST } = await collection()
    const res = await POST(req("POST", { body: {} }))
    expect(res.status).toBe(401)
  })

  it("rejects a bearer API key (management is session-only)", async () => {
    const { POST } = await collection()
    const { raw } = await createApiKey(userA)
    // no session, only a valid bearer key
    const res = await POST(req("POST", { body: {}, bearer: raw }))
    expect(res.status).toBe(401)
  })
})

describe("GET /api/api-keys", () => {
  it("lists the session user's keys as metadata only", async () => {
    const { GET } = await collection()
    await createApiKey(userA, "one")
    mockSession = { user: { id: userA } }
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0]).not.toHaveProperty("hashedKey")
    expect(body[0]).not.toHaveProperty("key")
  })

  it("never returns another user's keys", async () => {
    const { GET } = await collection()
    await createApiKey(userB, "b")
    mockSession = { user: { id: userA } }
    const res = await GET()
    expect(await res.json()).toHaveLength(0)
  })

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await collection()
    const res = await GET()
    expect(res.status).toBe(401)
  })
})

describe("DELETE /api/api-keys/:id", () => {
  function delReq(bearer?: string) {
    const headers: Record<string, string> = {}
    if (bearer !== undefined) headers.authorization = `Bearer ${bearer}`
    return new NextRequest("http://localhost/api/api-keys/x", {
      method: "DELETE",
      headers,
    })
  }

  it("revokes an owned key (204) and it can no longer authenticate", async () => {
    const { DELETE } = await member()
    const { id, raw } = await createApiKey(userA)
    mockSession = { user: { id: userA } }
    const res = await DELETE(delReq(), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(204)
    expect(await resolveApiKey(raw)).toBeNull()
  })

  it("returns 403 revoking another user's key, and the key stays active", async () => {
    const { DELETE } = await member()
    const { id, raw } = await createApiKey(userA)
    mockSession = { user: { id: userB } }
    const res = await DELETE(delReq(), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(403)
    expect(await resolveApiKey(raw)).not.toBeNull()
  })

  it("returns 401 when unauthenticated", async () => {
    const { DELETE } = await member()
    const { id } = await createApiKey(userA)
    const res = await DELETE(delReq(), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(401)
  })

  it("rejects a bearer API key (management is session-only)", async () => {
    const { DELETE } = await member()
    const { id, raw } = await createApiKey(userA)
    const res = await DELETE(delReq(raw), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(401)
  })
})
