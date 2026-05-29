import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"

const TEST_EMAIL_DOMAIN = "@tags-integration-test.example"

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
  await db.tag.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  })
  await db.user.deleteMany({
    where: { email: { contains: TEST_EMAIL_DOMAIN } },
  })
  currentUserId = ""
})

// Lazy import route after mock is set up
async function getTagsRoutes() {
  const mod = await import("@/app/api/tags/route")
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

describe("GET /api/tags", () => {
  it("returns 200 with empty array when user has no tags", async () => {
    const { GET } = await getTagsRoutes()
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it("returns 200 with tags for the authenticated user", async () => {
    const { POST, GET } = await getTagsRoutes()
    await POST(makeRequest("http://localhost/api/tags", "POST", { name: "alpha" }))
    await POST(makeRequest("http://localhost/api/tags", "POST", { name: "beta" }))

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    const names = body.map((t: { name: string }) => t.name)
    expect(names).toContain("alpha")
    expect(names).toContain("beta")
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { GET } = await getTagsRoutes()
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns only the current user's tags (isolation between users)", async () => {
    const { POST, GET } = await getTagsRoutes()

    // Create tag for userA
    await POST(makeRequest("http://localhost/api/tags", "POST", { name: "userA-tag" }))

    // Create tag for userB
    currentUserId = userB.id
    await POST(makeRequest("http://localhost/api/tags", "POST", { name: "userB-tag" }))

    // List as userA — should only see their own tag
    currentUserId = userA.id
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe("userA-tag")
  })
})

describe("POST /api/tags", () => {
  it("creates a tag and returns 201", async () => {
    const { POST } = await getTagsRoutes()
    const res = await POST(
      makeRequest("http://localhost/api/tags", "POST", { name: "my-tag" })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty("id")
    expect(body.name).toBe("my-tag")
  })

  it("returns 400 when name is empty string", async () => {
    const { POST } = await getTagsRoutes()
    const res = await POST(
      makeRequest("http://localhost/api/tags", "POST", { name: "" })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Tag name required")
  })

  it("returns 400 when name exceeds 32 characters", async () => {
    const { POST } = await getTagsRoutes()
    const res = await POST(
      makeRequest("http://localhost/api/tags", "POST", { name: "a".repeat(33) })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Max 32 characters")
  })

  it("returns 409 when creating a duplicate tag name for the same user", async () => {
    const { POST } = await getTagsRoutes()
    await POST(makeRequest("http://localhost/api/tags", "POST", { name: "duplicate" }))
    const res = await POST(
      makeRequest("http://localhost/api/tags", "POST", { name: "duplicate" })
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("Tag already exists")
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { POST } = await getTagsRoutes()
    const res = await POST(
      makeRequest("http://localhost/api/tags", "POST", { name: "some-tag" })
    )
    expect(res.status).toBe(401)
  })
})
