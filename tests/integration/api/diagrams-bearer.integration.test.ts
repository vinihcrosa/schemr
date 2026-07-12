import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createApiKey, revokeApiKey } from "@/lib/api-key"
import { authConfig } from "@/auth.config"

// This suite exercises the REAL auth path (requireActor) — it does NOT mock
// @/lib/auth. The session branch is driven by mocking @/auth's `auth()`.
let mockSession: { user: { id: string } } | null = null
vi.mock("@/auth", () => ({
  auth: async () => mockSession,
}))

const TEST_EMAIL_DOMAIN = "@diagrams-bearer-test.example"

let userA: string
let userB: string

async function routes() {
  return import("@/app/api/diagrams/route")
}

function req(method: string, opts: { bearer?: string } = {}): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (opts.bearer !== undefined) headers.authorization = `Bearer ${opts.bearer}`
  return new NextRequest("http://localhost/api/diagrams", {
    method,
    headers,
    body: method === "POST" ? JSON.stringify({}) : undefined,
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
  await db.diagram.deleteMany({ where: { userId: { in: [userA, userB] } } })
  await db.user.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
})

describe("diagram routes — bearer authentication", () => {
  it("authenticates GET /api/diagrams with a valid bearer key", async () => {
    const { POST, GET } = await routes()
    const { raw } = await createApiKey(userA)
    await POST(req("POST", { bearer: raw }))

    const res = await GET(req("GET", { bearer: raw }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })

  it("scopes bearer requests to the key owner (no cross-user leak)", async () => {
    const { POST, GET } = await routes()
    const keyA = (await createApiKey(userA)).raw
    const keyB = (await createApiKey(userB)).raw
    await POST(req("POST", { bearer: keyA }))

    const res = await GET(req("GET", { bearer: keyB }))
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(0)
  })

  it("returns 401 for a malformed bearer key", async () => {
    const { GET } = await routes()
    const res = await GET(req("GET", { bearer: "not-a-real-key" }))
    expect(res.status).toBe(401)
  })

  it("returns 401 for a revoked bearer key", async () => {
    const { GET } = await routes()
    const { id, raw } = await createApiKey(userA)
    await revokeApiKey(id, userA)
    const res = await GET(req("GET", { bearer: raw }))
    expect(res.status).toBe(401)
  })

  it("returns 401 for an empty bearer value", async () => {
    const { GET } = await routes()
    const res = await GET(req("GET", { bearer: "" }))
    expect(res.status).toBe(401)
  })
})

describe("diagram routes — session still works (no regression)", () => {
  it("authenticates GET /api/diagrams with a session and no bearer", async () => {
    const { POST, GET } = await routes()
    mockSession = { user: { id: userA } }
    await POST(req("POST"))
    const res = await GET(req("GET"))
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })

  it("returns 401 with neither session nor bearer", async () => {
    const { GET } = await routes()
    const res = await GET(req("GET"))
    expect(res.status).toBe(401)
  })
})

describe("authorized callback — bearer allowance", () => {
  const authorized = authConfig.callbacks!.authorized!
  function check(pathname: string, loggedIn: boolean, bearer = false) {
    return authorized({
      auth: loggedIn ? ({ user: { id: "x" } } as never) : null,
      request: {
        nextUrl: { pathname },
        headers: new Headers(bearer ? { authorization: "Bearer sk_x" } : {}),
      } as never,
    } as never)
  }

  it("lets a bearer-carrying /api/* request through when logged out", () => {
    expect(check("/api/diagrams", false, true)).toBe(true)
  })

  it("lets an /api/* request through even with no bearer and no session — the handler returns 401 JSON (not an HTML sign-in redirect)", () => {
    expect(check("/api/diagrams", false, false)).toBe(true)
  })

  it("does not grant page routes via a bearer header", () => {
    expect(check("/diagrams/123", false, true)).toBe(false)
  })

  it("lets a bearer-carrying key-management request past the middleware (handler re-gates)", () => {
    // The middleware allowance is not authorization — /api/api-keys handlers
    // still reject bearer via requireSession. This only asserts the gate opens.
    expect(check("/api/api-keys", false, true)).toBe(true)
  })
})
