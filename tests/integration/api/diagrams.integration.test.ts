import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { MOCK_DIAGRAM, EMPTY_DIAGRAM } from "@/lib/excalidraw"

const TEST_EMAIL_DOMAIN = "@diagrams-integration-test.example"

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
  const ts = Date.now()
  userA = await db.user.create({
    data: {
      email: `userA_${ts}${TEST_EMAIL_DOMAIN}`,
      password: "hashed",
    },
    select: { id: true, email: true },
  })
  userB = await db.user.create({
    data: {
      email: `userB_${ts}${TEST_EMAIL_DOMAIN}`,
      password: "hashed",
    },
    select: { id: true, email: true },
  })
  currentUserId = userA.id
})

afterEach(async () => {
  await db.diagram.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  })
  await db.user.deleteMany({
    where: { email: { contains: TEST_EMAIL_DOMAIN } },
  })
  currentUserId = ""
})

// Lazy import routes after mock is set up
async function getCollectionRoutes() {
  const mod = await import("@/app/api/diagrams/route")
  return mod
}

async function getMemberRoutes() {
  const mod = await import("@/app/api/diagrams/[id]/route")
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

describe("POST /api/diagrams", () => {
  it("creates a diagram and returns 201 with DiagramDetail", async () => {
    const { POST } = await getCollectionRoutes()
    const req = makeRequest("http://localhost/api/diagrams", "POST", {
      name: "Test Diagram",
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty("id")
    expect(body.name).toBe("Test Diagram")
    expect(body).toHaveProperty("data")
    expect(body).toHaveProperty("updatedAt")
  })

  it("uses EMPTY_DIAGRAM when data is omitted", async () => {
    const { POST } = await getCollectionRoutes()
    const req = makeRequest("http://localhost/api/diagrams", "POST", {})
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.elements).toEqual([])
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { POST } = await getCollectionRoutes()
    const req = makeRequest("http://localhost/api/diagrams", "POST", {})
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid body (name too long)", async () => {
    const { POST } = await getCollectionRoutes()
    const req = makeRequest("http://localhost/api/diagrams", "POST", {
      name: "a".repeat(256),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe("GET /api/diagrams (list)", () => {
  it("returns only user A's diagrams", async () => {
    const { POST } = await getCollectionRoutes()
    await POST(makeRequest("http://localhost/api/diagrams", "POST", { name: "A1" }))
    await POST(makeRequest("http://localhost/api/diagrams", "POST", { name: "A2" }))

    // Create one for user B
    currentUserId = userB.id
    await POST(makeRequest("http://localhost/api/diagrams", "POST", { name: "B1" }))

    // List as user A
    currentUserId = userA.id
    const { GET } = await getCollectionRoutes()
    const res = await GET(makeRequest("http://localhost/api/diagrams"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.length).toBe(2)
    expect(body.every((d: { name: string }) => d.name !== "B1")).toBe(true)
  })

  it("returns empty array when user has no diagrams", async () => {
    const { GET } = await getCollectionRoutes()
    const res = await GET(makeRequest("http://localhost/api/diagrams"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it("response items do not include data field", async () => {
    const { POST, GET } = await getCollectionRoutes()
    await POST(makeRequest("http://localhost/api/diagrams", "POST", {}))
    const res = await GET(makeRequest("http://localhost/api/diagrams"))
    const body = await res.json()
    expect(body[0]).not.toHaveProperty("data")
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { GET } = await getCollectionRoutes()
    const res = await GET(makeRequest("http://localhost/api/diagrams"))
    expect(res.status).toBe(401)
  })
})

describe("GET /api/diagrams/:id", () => {
  it("returns full DiagramDetail for owner", async () => {
    const { POST } = await getCollectionRoutes()
    const createRes = await POST(
      makeRequest("http://localhost/api/diagrams", "POST", {
        name: "My Diagram",
        data: MOCK_DIAGRAM,
      })
    )
    const created = await createRes.json()

    const { GET } = await getMemberRoutes()
    const res = await GET(
      makeRequest(`http://localhost/api/diagrams/${created.id}`),
      { params: Promise.resolve({ id: created.id }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("data")
    expect(body.data.elements.length).toBeGreaterThan(0)
  })

  it("returns 403 when diagram belongs to another user", async () => {
    currentUserId = userB.id
    const { POST } = await getCollectionRoutes()
    const createRes = await POST(
      makeRequest("http://localhost/api/diagrams", "POST", {})
    )
    const created = await createRes.json()

    currentUserId = userA.id
    const { GET } = await getMemberRoutes()
    const res = await GET(
      makeRequest(`http://localhost/api/diagrams/${created.id}`),
      { params: Promise.resolve({ id: created.id }) }
    )
    expect(res.status).toBe(403)
  })

  it("returns 403 for non-existent diagram", async () => {
    const { GET } = await getMemberRoutes()
    const res = await GET(
      makeRequest("http://localhost/api/diagrams/nonexistent-id"),
      { params: Promise.resolve({ id: "nonexistent-id" }) }
    )
    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { GET } = await getMemberRoutes()
    const res = await GET(
      makeRequest("http://localhost/api/diagrams/any-id"),
      { params: Promise.resolve({ id: "any-id" }) }
    )
    expect(res.status).toBe(401)
  })
})

describe("DELETE /api/diagrams/:id", () => {
  it("deletes own diagram and returns 200", async () => {
    const { POST } = await getCollectionRoutes()
    const createRes = await POST(
      makeRequest("http://localhost/api/diagrams", "POST", {})
    )
    const created = await createRes.json()

    const { DELETE } = await getMemberRoutes()
    const res = await DELETE(
      makeRequest(`http://localhost/api/diagrams/${created.id}`, "DELETE"),
      { params: Promise.resolve({ id: created.id }) }
    )
    expect(res.status).toBe(200)

    const record = await db.diagram.findFirst({ where: { id: created.id } })
    expect(record).toBeNull()
  })

  it("returns 403 when diagram belongs to another user", async () => {
    currentUserId = userB.id
    const { POST } = await getCollectionRoutes()
    const createRes = await POST(
      makeRequest("http://localhost/api/diagrams", "POST", {})
    )
    const created = await createRes.json()

    currentUserId = userA.id
    const { DELETE } = await getMemberRoutes()
    const res = await DELETE(
      makeRequest(`http://localhost/api/diagrams/${created.id}`, "DELETE"),
      { params: Promise.resolve({ id: created.id }) }
    )
    expect(res.status).toBe(403)

    const record = await db.diagram.findFirst({ where: { id: created.id } })
    expect(record).not.toBeNull()
  })

  it("returns 403 for non-existent id (opaque)", async () => {
    const { DELETE } = await getMemberRoutes()
    const res = await DELETE(
      makeRequest("http://localhost/api/diagrams/nonexistent-id", "DELETE"),
      { params: Promise.resolve({ id: "nonexistent-id" }) }
    )
    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { DELETE } = await getMemberRoutes()
    const res = await DELETE(
      makeRequest("http://localhost/api/diagrams/any-id", "DELETE"),
      { params: Promise.resolve({ id: "any-id" }) }
    )
    expect(res.status).toBe(401)
  })

  it("removed diagram no longer appears in GET /api/diagrams list", async () => {
    const { POST, GET } = await getCollectionRoutes()
    const createRes = await POST(
      makeRequest("http://localhost/api/diagrams", "POST", { name: "To Delete" })
    )
    const created = await createRes.json()

    const { DELETE } = await getMemberRoutes()
    await DELETE(
      makeRequest(`http://localhost/api/diagrams/${created.id}`, "DELETE"),
      { params: Promise.resolve({ id: created.id }) }
    )

    const listRes = await GET(makeRequest("http://localhost/api/diagrams"))
    const body = await listRes.json()
    expect(body.every((d: { id: string }) => d.id !== created.id)).toBe(true)
  })
})

describe("PUT /api/diagrams/:id", () => {
  it("updates data and updatedAt", async () => {
    const { POST } = await getCollectionRoutes()
    const createRes = await POST(
      makeRequest("http://localhost/api/diagrams", "POST", {})
    )
    const created = await createRes.json()

    const { PUT } = await getMemberRoutes()
    const res = await PUT(
      makeRequest(`http://localhost/api/diagrams/${created.id}`, "PUT", {
        data: MOCK_DIAGRAM,
      }),
      { params: Promise.resolve({ id: created.id }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.elements.length).toBeGreaterThan(0)
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime()
    )
  })

  it("returns 403 when diagram belongs to another user", async () => {
    currentUserId = userB.id
    const { POST } = await getCollectionRoutes()
    const createRes = await POST(
      makeRequest("http://localhost/api/diagrams", "POST", {})
    )
    const created = await createRes.json()

    currentUserId = userA.id
    const { PUT } = await getMemberRoutes()
    const res = await PUT(
      makeRequest(`http://localhost/api/diagrams/${created.id}`, "PUT", {
        data: EMPTY_DIAGRAM,
      }),
      { params: Promise.resolve({ id: created.id }) }
    )
    expect(res.status).toBe(403)
  })

  it("returns 400 when body has neither name nor data", async () => {
    const { POST } = await getCollectionRoutes()
    const createRes = await POST(
      makeRequest("http://localhost/api/diagrams", "POST", {})
    )
    const created = await createRes.json()

    const { PUT } = await getMemberRoutes()
    const res = await PUT(
      makeRequest(`http://localhost/api/diagrams/${created.id}`, "PUT", {}),
      { params: Promise.resolve({ id: created.id }) }
    )
    expect(res.status).toBe(400)
  })

  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { PUT } = await getMemberRoutes()
    const res = await PUT(
      makeRequest("http://localhost/api/diagrams/any-id", "PUT", {
        data: EMPTY_DIAGRAM,
      }),
      { params: Promise.resolve({ id: "any-id" }) }
    )
    expect(res.status).toBe(401)
  })
})
