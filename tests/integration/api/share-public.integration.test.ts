import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { EMPTY_DIAGRAM } from "@/lib/excalidraw"
import { shareDiagram, unshareDiagram } from "@/lib/diagrams"
import { GET } from "@/app/api/share/[token]/route"
import { authConfig } from "@/auth.config"

const TEST_EMAIL_DOMAIN = "@share-public-test.example"

let userId: string
let diagramId: string

beforeEach(async () => {
  const user = await db.user.create({
    data: { email: `u_${Date.now()}${TEST_EMAIL_DOMAIN}`, password: "h" },
  })
  userId = user.id
  diagramId = (
    await db.diagram.create({ data: { userId, name: "Public Diagram", data: EMPTY_DIAGRAM as object } })
  ).id
})

afterEach(async () => {
  await db.user.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
})

function call(token: string) {
  return GET(new NextRequest(`http://localhost/api/share/${token}`), {
    params: Promise.resolve({ token }),
  })
}

describe("GET /api/share/:token (public, no auth)", () => {
  it("returns 200 with only { name, data } for a valid token", async () => {
    const { shareToken } = (await shareDiagram(diagramId, userId))!
    const res = await call(shareToken)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(["data", "name"])
    expect(body.name).toBe("Public Diagram")
    expect(body).not.toHaveProperty("userId")
  })

  it("returns 404 for a revoked token", async () => {
    const { shareToken } = (await shareDiagram(diagramId, userId))!
    await unshareDiagram(diagramId, userId)
    const res = await call(shareToken)
    expect(res.status).toBe(404)
  })

  it("returns 404 (not 500) for a malformed / unknown token", async () => {
    const res = await call("!!not-a-real-token!!")
    expect(res.status).toBe(404)
  })
})

describe("middleware allowlist (authorized callback)", () => {
  const authorized = authConfig.callbacks!.authorized!

  function check(pathname: string, loggedIn: boolean) {
    return authorized({
      auth: loggedIn ? ({ user: { id: "x" } } as never) : null,
      request: { nextUrl: { pathname } } as never,
    } as never)
  }

  it("lets /api/share/* through without a session", () => {
    expect(check("/api/share/abc", false)).toBe(true)
  })

  it("lets /share/* through without a session", () => {
    expect(check("/share/abc", false)).toBe(true)
  })

  it("still blocks a protected path when logged out", () => {
    expect(check("/diagrams/123", false)).toBe(false)
  })
})
