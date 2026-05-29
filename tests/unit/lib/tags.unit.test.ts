import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    tag: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    diagram: {
      findFirst: vi.fn(),
    },
    diagramTag: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"
import { listTags, createTag, deleteTag, assignTag, removeTag } from "@/lib/tags"

const mockDb = db as {
  tag: {
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  diagram: {
    findFirst: ReturnType<typeof vi.fn>
  }
  diagramTag: {
    upsert: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("listTags", () => {
  it("calls db.tag.findMany with userId and returns results", async () => {
    const tags = [{ id: "t1", name: "alpha" }, { id: "t2", name: "beta" }]
    mockDb.tag.findMany.mockResolvedValue(tags)

    const result = await listTags("user-1")

    expect(mockDb.tag.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    expect(result).toEqual(tags)
  })
})

describe("createTag", () => {
  it("trims the name before creating", async () => {
    const created = { id: "t1", name: "hello" }
    mockDb.tag.create.mockResolvedValue(created)

    const result = await createTag("user-1", "  hello  ")

    expect(mockDb.tag.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "hello" },
      select: { id: true, name: true },
    })
    expect(result).toEqual(created)
  })
})

describe("deleteTag", () => {
  it("throws 'not found' when findFirst returns null", async () => {
    mockDb.tag.findFirst.mockResolvedValue(null)

    await expect(deleteTag("user-1", "tag-x")).rejects.toThrow("not found")
    expect(mockDb.tag.delete).not.toHaveBeenCalled()
  })

  it("calls db.tag.delete when tag is owned by user", async () => {
    mockDb.tag.findFirst.mockResolvedValue({ id: "tag-1", name: "test" })
    mockDb.tag.delete.mockResolvedValue(undefined)

    await deleteTag("user-1", "tag-1")

    expect(mockDb.tag.delete).toHaveBeenCalledWith({ where: { id: "tag-1" } })
  })
})

describe("assignTag", () => {
  it("throws 'not found' when diagram does not belong to user", async () => {
    mockDb.diagram.findFirst.mockResolvedValue(null)
    mockDb.tag.findFirst.mockResolvedValue({ id: "tag-1", name: "t" })

    await expect(assignTag("user-1", "diag-x", "tag-1")).rejects.toThrow("not found")
    expect(mockDb.diagramTag.upsert).not.toHaveBeenCalled()
  })

  it("throws 'not found' when tag does not belong to user", async () => {
    mockDb.diagram.findFirst.mockResolvedValue({ id: "diag-1" })
    mockDb.tag.findFirst.mockResolvedValue(null)

    await expect(assignTag("user-1", "diag-1", "tag-x")).rejects.toThrow("not found")
    expect(mockDb.diagramTag.upsert).not.toHaveBeenCalled()
  })

  it("calls diagramTag.upsert when both diagram and tag are owned", async () => {
    mockDb.diagram.findFirst.mockResolvedValue({ id: "diag-1" })
    mockDb.tag.findFirst.mockResolvedValue({ id: "tag-1", name: "t" })
    mockDb.diagramTag.upsert.mockResolvedValue(undefined)

    await assignTag("user-1", "diag-1", "tag-1")

    expect(mockDb.diagramTag.upsert).toHaveBeenCalledWith({
      where: { diagramId_tagId: { diagramId: "diag-1", tagId: "tag-1" } },
      create: { diagramId: "diag-1", tagId: "tag-1" },
      update: {},
    })
  })
})

describe("removeTag", () => {
  it("calls diagramTag.deleteMany after verifying diagram ownership", async () => {
    mockDb.diagram.findFirst.mockResolvedValue({ id: "diag-1" })
    mockDb.diagramTag.deleteMany.mockResolvedValue({ count: 1 })

    await removeTag("user-1", "diag-1", "tag-1")

    expect(mockDb.diagram.findFirst).toHaveBeenCalledWith({
      where: { id: "diag-1", userId: "user-1" },
    })
    expect(mockDb.diagramTag.deleteMany).toHaveBeenCalledWith({
      where: { diagramId: "diag-1", tagId: "tag-1" },
    })
  })

  it("throws 'not found' when diagram not owned", async () => {
    mockDb.diagram.findFirst.mockResolvedValue(null)

    await expect(removeTag("user-1", "diag-x", "tag-1")).rejects.toThrow("not found")
    expect(mockDb.diagramTag.deleteMany).not.toHaveBeenCalled()
  })
})
