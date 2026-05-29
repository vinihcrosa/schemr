import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"

const TEST_EMAIL_DOMAIN = "@tags-id-integration-test.example"

let userA: { id: string; email: string }
let userB: { id: string; email: string }

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
  const suffix = crypto.randomUUID()
  userA = await db.user.create({
    data: {
      email: `userA_${suffix}${TEST_EMAIL_DOMAIN}`,
      password: "hashed",
    },
    select: { id: true, email: true },
  })
  userB = await db.user.create({
    data: {
      email: `userB_${suffix}${TEST_EMAIL_DOMAIN}`,
      password: "hashed",
    },
    select: { id: true, email: true },
  })
  currentUserId = userA.id
})

afterEach(async () => {
  await db.diagramTag.deleteMany({
    where: { diagram: { userId: { in: [userA.id, userB.id] } } },
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

async function getMemberRoutes() {
  const mod = await import("@/app/api/tags/[id]/route")
  return mod
}

function makeRequest(url: string, method = "DELETE"): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
  })
}

describe("DELETE /api/tags/:id", () => {
  it("returns 204 and tag is gone after deletion", async () => {
    const tag = await db.tag.create({
      data: { userId: userA.id, name: "mytag" },
    })

    const { DELETE } = await getMemberRoutes()
    const res = await DELETE(
      makeRequest(`http://localhost/api/tags/${tag.id}`),
      { params: Promise.resolve({ id: tag.id }) }
    )

    expect(res.status).toBe(204)

    const record = await db.tag.findFirst({ where: { id: tag.id } })
    expect(record).toBeNull()
  })

  it("cascades and removes DiagramTag rows when tag is deleted", async () => {
    const { EMPTY_DIAGRAM } = await import("@/lib/excalidraw")
    const diagram = await db.diagram.create({
      data: { userId: userA.id, name: "D", data: EMPTY_DIAGRAM as object },
    })
    const tag = await db.tag.create({
      data: { userId: userA.id, name: "cascade-tag" },
    })
    await db.diagramTag.create({
      data: { diagramId: diagram.id, tagId: tag.id },
    })

    const countBefore = await db.diagramTag.count({
      where: { tagId: tag.id },
    })
    expect(countBefore).toBe(1)

    const { DELETE } = await getMemberRoutes()
    const res = await DELETE(
      makeRequest(`http://localhost/api/tags/${tag.id}`),
      { params: Promise.resolve({ id: tag.id }) }
    )
    expect(res.status).toBe(204)

    const countAfter = await db.diagramTag.count({
      where: { tagId: tag.id },
    })
    expect(countAfter).toBe(0)
  })

  it("returns 404 when tag belongs to another user", async () => {
    const tag = await db.tag.create({
      data: { userId: userB.id, name: "other-user-tag" },
    })

    const { DELETE } = await getMemberRoutes()
    const res = await DELETE(
      makeRequest(`http://localhost/api/tags/${tag.id}`),
      { params: Promise.resolve({ id: tag.id }) }
    )
    expect(res.status).toBe(404)

    const record = await db.tag.findFirst({ where: { id: tag.id } })
    expect(record).not.toBeNull()
  })

  it("returns 404 for nonexistent tag id", async () => {
    const { DELETE } = await getMemberRoutes()
    const res = await DELETE(
      makeRequest("http://localhost/api/tags/nonexistent-id"),
      { params: Promise.resolve({ id: "nonexistent-id" }) }
    )
    expect(res.status).toBe(404)
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { DELETE } = await getMemberRoutes()
    const res = await DELETE(
      makeRequest("http://localhost/api/tags/any-id"),
      { params: Promise.resolve({ id: "any-id" }) }
    )
    expect(res.status).toBe(401)
  })
})
