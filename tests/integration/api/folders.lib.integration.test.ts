import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { db } from "@/lib/db"
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
} from "@/lib/folders"

const TEST_EMAIL_DOMAIN = "@folders-lib-integration-test.example"

let userId: string

beforeEach(async () => {
  const ts = Date.now()
  const user = await db.user.create({
    data: { email: `user_${ts}${TEST_EMAIL_DOMAIN}`, password: "hashed" },
    select: { id: true },
  })
  userId = user.id
})

afterEach(async () => {
  await db.folder.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
})

describe("listFolders", () => {
  it("returns empty array when user has no folders", async () => {
    const result = await listFolders(userId)
    expect(result).toEqual([])
  })

  it("returns all folders for user", async () => {
    await createFolder(userId, "A")
    await createFolder(userId, "B")
    const result = await listFolders(userId)
    expect(result).toHaveLength(2)
  })
})

describe("createFolder", () => {
  it("creates folder with default name when name omitted", async () => {
    const f = await createFolder(userId)
    expect(f.name).toBe("New Folder")
    expect(f.parentFolderId).toBeNull()
    expect(f.id).toBeTruthy()
  })

  it("creates folder with given name", async () => {
    const f = await createFolder(userId, "My Folder")
    expect(f.name).toBe("My Folder")
  })

  it("creates nested folder with parentFolderId", async () => {
    const parent = await createFolder(userId, "Parent")
    const child = await createFolder(userId, "Child", parent.id)
    expect(child.parentFolderId).toBe(parent.id)
  })
})

describe("updateFolder", () => {
  it("renames folder", async () => {
    const f = await createFolder(userId, "Old")
    const updated = await updateFolder(f.id, userId, { name: "New" })
    expect(updated?.name).toBe("New")
  })

  it("updates parentFolderId", async () => {
    const parent = await createFolder(userId, "Parent")
    const child = await createFolder(userId, "Child")
    const updated = await updateFolder(child.id, userId, { parentFolderId: parent.id })
    expect(updated?.parentFolderId).toBe(parent.id)
  })

  it("sets parentFolderId to null (move to root)", async () => {
    const parent = await createFolder(userId, "Parent")
    const child = await createFolder(userId, "Child", parent.id)
    const updated = await updateFolder(child.id, userId, { parentFolderId: null })
    expect(updated?.parentFolderId).toBeNull()
  })

  it("returns null when folder not found", async () => {
    const result = await updateFolder("nonexistent", userId, { name: "X" })
    expect(result).toBeNull()
  })
})

describe("deleteFolder", () => {
  it("returns false when folder not found", async () => {
    const result = await deleteFolder("nonexistent", userId)
    expect(result).toBe(false)
  })

  it("deletes folder and returns true", async () => {
    const f = await createFolder(userId, "ToDelete")
    const result = await deleteFolder(f.id, userId)
    expect(result).toBe(true)
    const found = await db.folder.findFirst({ where: { id: f.id } })
    expect(found).toBeNull()
  })

  it("moves child diagrams to root (folderId → null) on delete", async () => {
    const f = await createFolder(userId, "F")
    const diagram = await db.diagram.create({
      data: { userId, name: "D", data: {}, folderId: f.id },
    })
    await deleteFolder(f.id, userId)
    const d = await db.diagram.findFirst({ where: { id: diagram.id } })
    expect(d?.folderId).toBeNull()
  })

  it("moves subfolders to root (parentFolderId → null) on delete", async () => {
    const parent = await createFolder(userId, "Parent")
    const child = await createFolder(userId, "Child", parent.id)
    await deleteFolder(parent.id, userId)
    const c = await db.folder.findFirst({ where: { id: child.id } })
    expect(c?.parentFolderId).toBeNull()
  })
})
