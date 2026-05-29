import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"

const TEST_EMAIL_DOMAIN = "@diagram-tags-integration-test.example"

// Two test users
let userA: { id: string; email: string }
let userB: { id: string; email: string }

// Track sessions for mocking
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

beforeEach(async () => {
  const uuid = crypto.randomUUID()
  userA = await db.user.create({
    data: {
      email: `userA_${uuid}${TEST_EMAIL_DOMAIN}`,
      password: "hashed",
    },
    select: { id: true, email: true },
  })
  userB = await db.user.create({
    data: {
      email: `userB_${uuid}${TEST_EMAIL_DOMAIN}`,
      password: "hashed",
    },
    select: { id: true, email: true },
  })
  currentUserId = userA.id
})

afterEach(async () => {
  await db.diagramTag.deleteMany({
    where: {
      diagram: { userId: { in: [userA.id, userB.id] } },
    },
  })
  await db.diagram.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  })
  await db.tag.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  })
  await db.user.deleteMany({
    where: { email: { contains: TEST_EMAIL_DOMAIN } },
  })
  currentUserId = ""
})

// Lazy import route after mock is set up
async function getDiagramTagRoutes() {
  const mod = await import("@/app/api/diagrams/[id]/tags/[tagId]/route")
  return mod
}

function makeRequest(
  url: string,
  method = "GET",
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe("POST /api/diagrams/:id/tags/:tagId", () => {
  it("returns 201 and creates a DiagramTag row", async () => {
    const diag = await db.diagram.create({
      data: { userId: userA.id, name: "D", data: {} },
    })
    const tag = await db.tag.create({
      data: { userId: userA.id, name: "t1" },
    })

    const { POST } = await getDiagramTagRoutes()
    const res = await POST(
      makeRequest(`http://localhost/api/diagrams/${diag.id}/tags/${tag.id}`, "POST"),
      { params: Promise.resolve({ id: diag.id, tagId: tag.id }) }
    )
    expect(res.status).toBe(201)

    const row = await db.diagramTag.findFirst({
      where: { diagramId: diag.id, tagId: tag.id },
    })
    expect(row).not.toBeNull()
  })

  it("is idempotent — second POST still returns 201 with no duplicate", async () => {
    const diag = await db.diagram.create({
      data: { userId: userA.id, name: "D", data: {} },
    })
    const tag = await db.tag.create({
      data: { userId: userA.id, name: "t2" },
    })

    const { POST } = await getDiagramTagRoutes()
    const params = { params: Promise.resolve({ id: diag.id, tagId: tag.id }) }
    await POST(
      makeRequest(`http://localhost/api/diagrams/${diag.id}/tags/${tag.id}`, "POST"),
      params
    )
    const res = await POST(
      makeRequest(`http://localhost/api/diagrams/${diag.id}/tags/${tag.id}`, "POST"),
      { params: Promise.resolve({ id: diag.id, tagId: tag.id }) }
    )
    expect(res.status).toBe(201)

    const rows = await db.diagramTag.findMany({
      where: { diagramId: diag.id, tagId: tag.id },
    })
    expect(rows).toHaveLength(1)
  })

  it("returns 404 when diagram belongs to a different user", async () => {
    const diag = await db.diagram.create({
      data: { userId: userB.id, name: "D", data: {} },
    })
    const tag = await db.tag.create({
      data: { userId: userA.id, name: "t3" },
    })

    const { POST } = await getDiagramTagRoutes()
    const res = await POST(
      makeRequest(`http://localhost/api/diagrams/${diag.id}/tags/${tag.id}`, "POST"),
      { params: Promise.resolve({ id: diag.id, tagId: tag.id }) }
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when tag belongs to a different user", async () => {
    const diag = await db.diagram.create({
      data: { userId: userA.id, name: "D", data: {} },
    })
    const tag = await db.tag.create({
      data: { userId: userB.id, name: "t4" },
    })

    const { POST } = await getDiagramTagRoutes()
    const res = await POST(
      makeRequest(`http://localhost/api/diagrams/${diag.id}/tags/${tag.id}`, "POST"),
      { params: Promise.resolve({ id: diag.id, tagId: tag.id }) }
    )
    expect(res.status).toBe(404)
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { POST } = await getDiagramTagRoutes()
    const res = await POST(
      makeRequest("http://localhost/api/diagrams/any-id/tags/any-tag", "POST"),
      { params: Promise.resolve({ id: "any-id", tagId: "any-tag" }) }
    )
    expect(res.status).toBe(401)
  })
})

describe("DELETE /api/diagrams/:id/tags/:tagId", () => {
  it("returns 204 and removes the DiagramTag row", async () => {
    const diag = await db.diagram.create({
      data: { userId: userA.id, name: "D", data: {} },
    })
    const tag = await db.tag.create({
      data: { userId: userA.id, name: "t5" },
    })
    await db.diagramTag.create({
      data: { diagramId: diag.id, tagId: tag.id },
    })

    const { DELETE } = await getDiagramTagRoutes()
    const res = await DELETE(
      makeRequest(`http://localhost/api/diagrams/${diag.id}/tags/${tag.id}`, "DELETE"),
      { params: Promise.resolve({ id: diag.id, tagId: tag.id }) }
    )
    expect(res.status).toBe(204)

    const row = await db.diagramTag.findFirst({
      where: { diagramId: diag.id, tagId: tag.id },
    })
    expect(row).toBeNull()
  })

  it("is idempotent — DELETE on non-existent assignment still returns 204", async () => {
    const diag = await db.diagram.create({
      data: { userId: userA.id, name: "D", data: {} },
    })
    const tag = await db.tag.create({
      data: { userId: userA.id, name: "t6" },
    })

    const { DELETE } = await getDiagramTagRoutes()
    const res = await DELETE(
      makeRequest(`http://localhost/api/diagrams/${diag.id}/tags/${tag.id}`, "DELETE"),
      { params: Promise.resolve({ id: diag.id, tagId: tag.id }) }
    )
    expect(res.status).toBe(204)
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { DELETE } = await getDiagramTagRoutes()
    const res = await DELETE(
      makeRequest("http://localhost/api/diagrams/any-id/tags/any-tag", "DELETE"),
      { params: Promise.resolve({ id: "any-id", tagId: "any-tag" }) }
    )
    expect(res.status).toBe(401)
  })
})
