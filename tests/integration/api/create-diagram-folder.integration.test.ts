import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { db } from "@/lib/db"
import { createDiagram } from "@/lib/diagrams"
import { createFolder } from "@/lib/folders"

const TEST_EMAIL_DOMAIN = "@create-folder-integration-test.example"

let user: { id: string; email: string }

beforeEach(async () => {
  const ts = Date.now()
  user = await db.user.create({
    data: { email: `u_${ts}${TEST_EMAIL_DOMAIN}`, password: "hashed" },
    select: { id: true, email: true },
  })
})

afterEach(async () => {
  await db.diagram.deleteMany({ where: { userId: user.id } })
  await db.folder.deleteMany({ where: { userId: user.id } })
  await db.user.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
})

describe("createDiagram with folderId (GEN-04)", () => {
  it("attaches the diagram to the given folder", async () => {
    const folder = await createFolder(user.id, "Specs")
    const d = await createDiagram(user.id, "In folder", undefined, folder.id)
    expect(d.folderId).toBe(folder.id)
    const row = await db.diagram.findUnique({ where: { id: d.id } })
    expect(row?.folderId).toBe(folder.id)
  })

  it("leaves folderId null when omitted (regression)", async () => {
    const d = await createDiagram(user.id, "No folder")
    expect(d.folderId).toBeNull()
  })

  it("leaves folderId null when passed null", async () => {
    const d = await createDiagram(user.id, "Null folder", undefined, null)
    expect(d.folderId).toBeNull()
  })
})
