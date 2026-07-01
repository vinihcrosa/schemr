import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { EMPTY_DIAGRAM } from "@/lib/excalidraw"

const TEST_EMAIL_DOMAIN = "@share-api-test.example"

let userA: { id: string }
let userB: { id: string }
let currentUserId = ""

vi.mock("@/lib/auth", () => ({
  requireSession: async () => {
    if (!currentUserId) throw new Response(null, { status: 401 })
    return { user: { id: currentUserId, email: "test@test.com" } }
  },
  getSession: async () => {
    if (!currentUserId) return null
    return { user: { id: currentUserId, email: "test@test.com" } }
  },
}))

async function getShareRoutes() {
  return import("@/app/api/diagrams/[id]/share/route")
}

function req(url: string, method: string): NextRequest {
  return new NextRequest(url, { method })
}

async function newDiagram(userId: string) {
  return db.diagram.create({
    data: { userId, name: "D", data: EMPTY_DIAGRAM as object },
  })
}

beforeEach(async () => {
  const ts = Date.now()
  userA = await db.user.create({ data: { email: `a_${ts}${TEST_EMAIL_DOMAIN}`, password: "h" } })
  userB = await db.user.create({ data: { email: `b_${ts}${TEST_EMAIL_DOMAIN}`, password: "h" } })
  currentUserId = userA.id
})

afterEach(async () => {
  await db.user.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
  currentUserId = ""
})

describe("POST /api/diagrams/:id/share", () => {
  it("mints a token and returns 200", async () => {
    const d = await newDiagram(userA.id)
    const { POST } = await getShareRoutes()
    const res = await POST(req(`http://localhost/api/diagrams/${d.id}/share`, "POST"), {
      params: Promise.resolve({ id: d.id }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.shareToken).toBeTruthy()
  })

  it("is idempotent — repeat call returns the same token", async () => {
    const d = await newDiagram(userA.id)
    const { POST } = await getShareRoutes()
    const p = { params: Promise.resolve({ id: d.id }) }
    const first = await (await POST(req(`http://localhost/x`, "POST"), p)).json()
    const second = await (await POST(req(`http://localhost/x`, "POST"), { params: Promise.resolve({ id: d.id }) })).json()
    expect(second.shareToken).toBe(first.shareToken)
  })

  it("returns 403 when not owner", async () => {
    const d = await newDiagram(userB.id)
    const { POST } = await getShareRoutes()
    const res = await POST(req(`http://localhost/x`, "POST"), {
      params: Promise.resolve({ id: d.id }),
    })
    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    const d = await newDiagram(userA.id)
    currentUserId = ""
    const { POST } = await getShareRoutes()
    const res = await POST(req(`http://localhost/x`, "POST"), {
      params: Promise.resolve({ id: d.id }),
    })
    expect(res.status).toBe(401)
  })
})

describe("DELETE /api/diagrams/:id/share", () => {
  it("revokes and returns 204", async () => {
    const d = await newDiagram(userA.id)
    const { POST, DELETE } = await getShareRoutes()
    await POST(req(`http://localhost/x`, "POST"), { params: Promise.resolve({ id: d.id }) })
    const res = await DELETE(req(`http://localhost/x`, "DELETE"), {
      params: Promise.resolve({ id: d.id }),
    })
    expect(res.status).toBe(204)
    const row = await db.diagram.findUnique({ where: { id: d.id } })
    expect(row!.shareToken).toBeNull()
  })

  it("re-enable after revoke mints a different token", async () => {
    const d = await newDiagram(userA.id)
    const { POST, DELETE } = await getShareRoutes()
    const p = () => ({ params: Promise.resolve({ id: d.id }) })
    const first = await (await POST(req(`http://localhost/x`, "POST"), p())).json()
    await DELETE(req(`http://localhost/x`, "DELETE"), p())
    const second = await (await POST(req(`http://localhost/x`, "POST"), p())).json()
    expect(second.shareToken).not.toBe(first.shareToken)
  })

  it("returns 403 when not owner", async () => {
    const d = await newDiagram(userB.id)
    const { DELETE } = await getShareRoutes()
    const res = await DELETE(req(`http://localhost/x`, "DELETE"), {
      params: Promise.resolve({ id: d.id }),
    })
    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { DELETE } = await getShareRoutes()
    const res = await DELETE(req(`http://localhost/x`, "DELETE"), {
      params: Promise.resolve({ id: "any" }),
    })
    expect(res.status).toBe(401)
  })
})
