import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"

const TEST_EMAIL_DOMAIN = "@folders-id-api-integration-test.example"

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

async function getItemRoutes() {
  const mod = await import("@/app/api/folders/[id]/route")
  return mod
}

function makeRequest(method: string, id: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/folders/${id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("PUT /api/folders/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const { PUT } = await getItemRoutes()
    const f = await db.folder.create({ data: { userId, name: "F" } })
    const res = await PUT(makeRequest("PUT", f.id, { name: "X" }), makeParams(f.id))
    expect(res.status).toBe(401)
  })

  it("renames folder", async () => {
    const f = await db.folder.create({ data: { userId, name: "Old" } })
    const { PUT } = await getItemRoutes()
    const res = await PUT(makeRequest("PUT", f.id, { name: "New" }), makeParams(f.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("New")
  })

  it("moves folder into another folder", async () => {
    const parent = await db.folder.create({ data: { userId, name: "Parent" } })
    const child = await db.folder.create({ data: { userId, name: "Child" } })
    const { PUT } = await getItemRoutes()
    const res = await PUT(
      makeRequest("PUT", child.id, { parentFolderId: parent.id }),
      makeParams(child.id)
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.parentFolderId).toBe(parent.id)
  })

  it("moves folder to root (parentFolderId: null)", async () => {
    const parent = await db.folder.create({ data: { userId, name: "P" } })
    const child = await db.folder.create({ data: { userId, name: "C", parentFolderId: parent.id } })
    const { PUT } = await getItemRoutes()
    const res = await PUT(
      makeRequest("PUT", child.id, { parentFolderId: null }),
      makeParams(child.id)
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.parentFolderId).toBeNull()
  })

  it("returns 422 when circular reference detected (self-parent)", async () => {
    const f = await db.folder.create({ data: { userId, name: "F" } })
    const { PUT } = await getItemRoutes()
    const res = await PUT(
      makeRequest("PUT", f.id, { parentFolderId: f.id }),
      makeParams(f.id)
    )
    expect(res.status).toBe(422)
  })

  it("returns 422 when moving parent into its own descendant", async () => {
    const a = await db.folder.create({ data: { userId, name: "A" } })
    const b = await db.folder.create({ data: { userId, name: "B", parentFolderId: a.id } })
    const { PUT } = await getItemRoutes()
    const res = await PUT(
      makeRequest("PUT", a.id, { parentFolderId: b.id }),
      makeParams(a.id)
    )
    expect(res.status).toBe(422)
  })

  it("returns 403 when folder not found", async () => {
    const { PUT } = await getItemRoutes()
    const res = await PUT(
      makeRequest("PUT", "nonexistent", { name: "X" }),
      makeParams("nonexistent")
    )
    expect(res.status).toBe(403)
  })

  it("returns 400 when body has neither name nor parentFolderId", async () => {
    const f = await db.folder.create({ data: { userId, name: "F" } })
    const { PUT } = await getItemRoutes()
    const res = await PUT(makeRequest("PUT", f.id, {}), makeParams(f.id))
    expect(res.status).toBe(400)
  })
})

describe("DELETE /api/folders/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    currentUserId = ""
    const f = await db.folder.create({ data: { userId, name: "F" } })
    const { DELETE } = await getItemRoutes()
    const res = await DELETE(makeRequest("DELETE", f.id), makeParams(f.id))
    expect(res.status).toBe(401)
  })

  it("deletes folder and returns 200", async () => {
    const f = await db.folder.create({ data: { userId, name: "F" } })
    const { DELETE } = await getItemRoutes()
    const res = await DELETE(makeRequest("DELETE", f.id), makeParams(f.id))
    expect(res.status).toBe(200)
    const found = await db.folder.findFirst({ where: { id: f.id } })
    expect(found).toBeNull()
  })

  it("moves child diagrams to root on delete", async () => {
    const f = await db.folder.create({ data: { userId, name: "F" } })
    const d = await db.diagram.create({ data: { userId, name: "D", data: {}, folderId: f.id } })
    const { DELETE } = await getItemRoutes()
    await DELETE(makeRequest("DELETE", f.id), makeParams(f.id))
    const diagram = await db.diagram.findFirst({ where: { id: d.id } })
    expect(diagram?.folderId).toBeNull()
  })

  it("moves subfolders to root on delete", async () => {
    const parent = await db.folder.create({ data: { userId, name: "P" } })
    const child = await db.folder.create({ data: { userId, name: "C", parentFolderId: parent.id } })
    const { DELETE } = await getItemRoutes()
    await DELETE(makeRequest("DELETE", parent.id), makeParams(parent.id))
    const c = await db.folder.findFirst({ where: { id: child.id } })
    expect(c?.parentFolderId).toBeNull()
  })

  it("returns 403 when folder not found", async () => {
    const { DELETE } = await getItemRoutes()
    const res = await DELETE(makeRequest("DELETE", "nonexistent"), makeParams("nonexistent"))
    expect(res.status).toBe(403)
  })
})
