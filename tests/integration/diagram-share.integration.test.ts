import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { db } from "@/lib/db"
import {
  shareDiagram,
  unshareDiagram,
  getDiagramByShareToken,
  getDiagramById,
} from "@/lib/diagrams"

const TEST_EMAIL_DOMAIN = "@share-test.example"
const EMPTY = { elements: [], appState: {}, files: {} }

async function createUser(suffix = "") {
  return db.user.create({
    data: { email: `u${Date.now()}${suffix}${TEST_EMAIL_DOMAIN}`, password: "hashed" },
  })
}

async function createDiagram(userId: string) {
  return db.diagram.create({
    data: { userId, name: "Shareable", data: EMPTY as object },
  })
}

afterEach(async () => {
  await db.$executeRaw`DELETE FROM "User" WHERE email LIKE ${`%${TEST_EMAIL_DOMAIN}`}`
})

describe("share data layer", () => {
  let userId: string
  let diagramId: string

  beforeEach(async () => {
    const user = await createUser()
    userId = user.id
    diagramId = (await createDiagram(userId)).id
  })

  it("mints a token and is idempotent", async () => {
    const first = await shareDiagram(diagramId, userId)
    const second = await shareDiagram(diagramId, userId)
    expect(first).not.toBeNull()
    expect(first!.shareToken).toBeTruthy()
    expect(second!.shareToken).toBe(first!.shareToken)
  })

  it("re-enabling after revoke mints a DIFFERENT token", async () => {
    const first = await shareDiagram(diagramId, userId)
    await unshareDiagram(diagramId, userId)
    const second = await shareDiagram(diagramId, userId)
    expect(second!.shareToken).not.toBe(first!.shareToken)
  })

  it("lookup by token returns only name + data, no owner/relational leak", async () => {
    const { shareToken } = (await shareDiagram(diagramId, userId))!
    const shared = await getDiagramByShareToken(shareToken)
    expect(shared).not.toBeNull()
    expect(Object.keys(shared!).sort()).toEqual(["data", "name"])
    expect(shared).not.toHaveProperty("userId")
    expect(shared).not.toHaveProperty("id")
    expect(shared).not.toHaveProperty("folderId")
    expect(shared).not.toHaveProperty("tags")
  })

  it("lookup returns null after revoke", async () => {
    const { shareToken } = (await shareDiagram(diagramId, userId))!
    await unshareDiagram(diagramId, userId)
    expect(await getDiagramByShareToken(shareToken)).toBeNull()
  })

  it("lookup returns null for a missing token", async () => {
    expect(await getDiagramByShareToken("does-not-exist")).toBeNull()
  })

  it("non-owner cannot share or unshare", async () => {
    const other = await createUser("-other")
    expect(await shareDiagram(diagramId, other.id)).toBeNull()
    await shareDiagram(diagramId, userId)
    expect(await unshareDiagram(diagramId, other.id)).toBe(false)
    // token survives the failed unshare
    const detail = await getDiagramById(diagramId, userId)
    expect(detail!.shareToken).toBeTruthy()
  })

  it("getDiagramById exposes shareToken to the owner", async () => {
    expect((await getDiagramById(diagramId, userId))!.shareToken).toBeNull()
    await shareDiagram(diagramId, userId)
    expect((await getDiagramById(diagramId, userId))!.shareToken).toBeTruthy()
  })
})
