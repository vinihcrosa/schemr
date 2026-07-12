import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"

const TEST_EMAIL_DOMAIN = "@from-spec-integration-test.example"

let userA: { id: string; email: string }
let userB: { id: string; email: string }
let currentUserId = ""
let currentSource: "session" | "apikey" = "session"

vi.mock("@/lib/auth", () => ({
  requireActor: async () => {
    if (!currentUserId) throw new Response(null, { status: 401 })
    return { userId: currentUserId, source: currentSource }
  },
}))

beforeEach(async () => {
  const ts = Date.now()
  userA = await db.user.create({
    data: { email: `a_${ts}${TEST_EMAIL_DOMAIN}`, password: "hashed" },
    select: { id: true, email: true },
  })
  userB = await db.user.create({
    data: { email: `b_${ts}${TEST_EMAIL_DOMAIN}`, password: "hashed" },
    select: { id: true, email: true },
  })
  currentUserId = userA.id
  currentSource = "session"
})

afterEach(async () => {
  await db.diagram.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } })
  await db.folder.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } })
  await db.user.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
  currentUserId = ""
})

async function POST(body: unknown) {
  const { POST } = await import("@/app/api/diagrams/from-spec/route")
  const req = new NextRequest("http://localhost/api/diagrams/from-spec", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
  return POST(req)
}

const FLOW = "flowchart TD\n  A[Start] --> B[End]"

describe("POST /api/diagrams/from-spec", () => {
  it("creates a diagram from a spec (session) → 201 (GEN-01)", async () => {
    const res = await POST({ spec: FLOW, format: "mermaid", name: "Flow" })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe("Flow")
    expect(body.data.elements.length).toBeGreaterThan(0)
    const row = await db.diagram.findUnique({ where: { id: body.id } })
    expect(row?.userId).toBe(userA.id)
  })

  it("works over the bearer/apikey actor path too (GEN-01)", async () => {
    currentSource = "apikey"
    const res = await POST({ spec: FLOW, format: "mermaid" })
    expect(res.status).toBe(201)
  })

  it("returns 401 when unauthenticated (GEN-03)", async () => {
    currentUserId = ""
    const res = await POST({ spec: FLOW, format: "mermaid" })
    expect(res.status).toBe(401)
  })

  it("returns 400 and writes no row on invalid mermaid (GEN-15)", async () => {
    const before = await db.diagram.count({ where: { userId: userA.id } })
    const res = await POST({ spec: "not mermaid {{{", format: "mermaid" })
    expect(res.status).toBe(400)
    const after = await db.diagram.count({ where: { userId: userA.id } })
    expect(after).toBe(before)
  })

  it("returns 400 on an unsupported format (GEN-14)", async () => {
    const res = await POST({ spec: FLOW, format: "svg" })
    expect(res.status).toBe(400)
  })

  it("returns 400 on missing spec (GEN-13)", async () => {
    const res = await POST({ format: "mermaid" })
    expect(res.status).toBe(400)
  })

  it("attaches to an owned folder (GEN-04)", async () => {
    const folder = await db.folder.create({
      data: { userId: userA.id, name: "F" },
      select: { id: true },
    })
    const res = await POST({ spec: FLOW, format: "mermaid", folderId: folder.id })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.folderId).toBe(folder.id)
  })

  it("rejects a folder owned by another user → 400, no row (GEN-04)", async () => {
    const foreign = await db.folder.create({
      data: { userId: userB.id, name: "B-folder" },
      select: { id: true },
    })
    const before = await db.diagram.count({ where: { userId: userA.id } })
    const res = await POST({ spec: FLOW, format: "mermaid", folderId: foreign.id })
    expect(res.status).toBe(400)
    const after = await db.diagram.count({ where: { userId: userA.id } })
    expect(after).toBe(before)
  })
})
