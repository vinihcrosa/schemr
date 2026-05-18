import { describe, it, expect } from "vitest"
import { buildSidebarTree, isDescendant } from "@/lib/sidebar-tree"
import type { FolderSummary, DiagramEntry } from "@/lib/sidebar-tree"

const diagram = (id: string, folderId?: string): DiagramEntry => ({
  id,
  name: `Diagram ${id}`,
  updatedAt: "2026-01-01T00:00:00.000Z",
  folderId: folderId ?? null,
})

const folder = (id: string, parentFolderId?: string): FolderSummary => ({
  id,
  name: `Folder ${id}`,
  parentFolderId: parentFolderId ?? null,
})

describe("buildSidebarTree", () => {
  it("returns empty tree when no folders or diagrams", () => {
    const result = buildSidebarTree([], [])
    expect(result.folders).toEqual([])
    expect(result.rootDiagrams).toEqual([])
  })

  it("places diagrams with no folderId into rootDiagrams", () => {
    const result = buildSidebarTree([], [diagram("d1"), diagram("d2")])
    expect(result.rootDiagrams).toHaveLength(2)
    expect(result.folders).toHaveLength(0)
  })

  it("places root folders (no parentFolderId) in top-level folders array", () => {
    const result = buildSidebarTree([folder("f1"), folder("f2")], [])
    expect(result.folders).toHaveLength(2)
    expect(result.folders.map((f) => f.id)).toEqual(["f1", "f2"])
  })

  it("nests child folder under parent folder", () => {
    const result = buildSidebarTree([folder("parent"), folder("child", "parent")], [])
    expect(result.folders).toHaveLength(1)
    expect(result.folders[0].id).toBe("parent")
    expect(result.folders[0].children).toHaveLength(1)
    expect(result.folders[0].children[0].id).toBe("child")
  })

  it("assigns diagrams to their folder", () => {
    const result = buildSidebarTree(
      [folder("f1")],
      [diagram("d1", "f1"), diagram("d2")]
    )
    expect(result.folders[0].diagrams).toHaveLength(1)
    expect(result.folders[0].diagrams[0].id).toBe("d1")
    expect(result.rootDiagrams).toHaveLength(1)
    expect(result.rootDiagrams[0].id).toBe("d2")
  })

  it("handles deeply nested folders (3 levels)", () => {
    const result = buildSidebarTree(
      [folder("a"), folder("b", "a"), folder("c", "b")],
      []
    )
    expect(result.folders).toHaveLength(1)
    expect(result.folders[0].children[0].children[0].id).toBe("c")
  })

  it("folder with no diagrams renders with empty diagrams array", () => {
    const result = buildSidebarTree([folder("f1")], [])
    expect(result.folders[0].diagrams).toEqual([])
  })
})

describe("isDescendant", () => {
  const folders: FolderSummary[] = [
    folder("root"),
    folder("child", "root"),
    folder("grandchild", "child"),
    folder("other"),
  ]

  it("returns true when candidate is direct child of ancestor", () => {
    expect(isDescendant(folders, "root", "child")).toBe(true)
  })

  it("returns true when candidate is grandchild of ancestor", () => {
    expect(isDescendant(folders, "root", "grandchild")).toBe(true)
  })

  it("returns false when candidate is not in ancestor subtree", () => {
    expect(isDescendant(folders, "root", "other")).toBe(false)
  })

  it("returns false when candidate equals ancestor (self is not descendant)", () => {
    expect(isDescendant(folders, "root", "root")).toBe(false)
  })

  it("returns false for unrelated folders", () => {
    expect(isDescendant(folders, "child", "other")).toBe(false)
  })
})
