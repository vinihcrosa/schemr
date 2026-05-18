import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"

const TEST_EMAIL_DOMAIN = "@folders-api-integration-test.example"

let userId: string
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
  const user = await db.user.create({
    data: { email: `user_${ts}${TEST_EMAIL_DOMAIN}`, password: "hashed" },
    select: { id: true },
  })
  userId = user.id
  currentUserId = userId
})

afterEach(async () => {
  await db.folder.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
  currentUserId = ""
})

async function getCollectionRoutes() {
  const mod = await import("@/app/api/folders/route")
  return mod
}

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/folders", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe("GET /api/folders", () => {
  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { GET } = await getCollectionRoutes()
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns empty array when user has no folders", async () => {
    const { GET } = await getCollectionRoutes()
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it("returns all folders for authenticated user", async () => {
    await db.folder.create({ data: { userId, name: "A" } })
    await db.folder.create({ data: { userId, name: "B" } })
    const { GET } = await getCollectionRoutes()
    const res = await GET()
    const body = await res.json()
    expect(body).toHaveLength(2)
  })
})

describe("POST /api/folders", () => {
  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { POST } = await getCollectionRoutes()
    const req = makeRequest("POST", {})
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates folder with default name when body is empty", async () => {
    const { POST } = await getCollectionRoutes()
    const req = makeRequest("POST", {})
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe("New Folder")
    expect(body.id).toBeTruthy()
  })

  it("creates folder with given name", async () => {
    const { POST } = await getCollectionRoutes()
    const req = makeRequest("POST", { name: "My Folder" })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe("My Folder")
  })

  it("creates nested folder with parentFolderId", async () => {
    const parent = await db.folder.create({ data: { userId, name: "Parent" } })
    const { POST } = await getCollectionRoutes()
    const req = makeRequest("POST", { parentFolderId: parent.id })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.parentFolderId).toBe(parent.id)
  })

  it("returns 400 when name is empty string", async () => {
    const { POST } = await getCollectionRoutes()
    const req = makeRequest("POST", { name: "" })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
