import { describe, it, expect } from "vitest"
import type { TagSummary } from "@/lib/tags"

type DiagramWithTags = {
  id: string
  name: string
  tags?: TagSummary[]
}

function filterDiagrams(
  diagrams: DiagramWithTags[],
  query: string | undefined,
  tagId: string | null | undefined
): DiagramWithTags[] {
  const q = (query || "").trim().toLowerCase()
  return diagrams
    .filter(d => !q || d.name.toLowerCase().includes(q))
    .filter(d => !tagId || d.tags?.some(t => t.id === tagId))
}

const sampleDiagrams: DiagramWithTags[] = [
  { id: "1", name: "Auth Flow", tags: [{ id: "tag-a", name: "auth" }] },
  { id: "2", name: "Payment Service", tags: [{ id: "tag-b", name: "payments" }] },
  { id: "3", name: "Auth Sequence", tags: [{ id: "tag-a", name: "auth" }, { id: "tag-c", name: "sequence" }] },
  { id: "4", name: "Database Schema", tags: [] },
  { id: "5", name: "User Profile", tags: undefined },
]

describe("filterDiagrams – name filter", () => {
  it("returns diagrams whose names match query (case-insensitive)", () => {
    const result = filterDiagrams(sampleDiagrams, "auth", null)
    expect(result.map(d => d.id)).toEqual(["1", "3"])
  })

  it("is case-insensitive", () => {
    const result = filterDiagrams(sampleDiagrams, "AUTH", null)
    expect(result.map(d => d.id)).toEqual(["1", "3"])
  })

  it("matches partial names", () => {
    const result = filterDiagrams(sampleDiagrams, "pay", null)
    expect(result.map(d => d.id)).toEqual(["2"])
  })
})

describe("filterDiagrams – no match", () => {
  it("returns empty array when no diagrams match the query", () => {
    const result = filterDiagrams(sampleDiagrams, "zzznomatch", null)
    expect(result).toHaveLength(0)
  })

  it("returns empty array when tag does not match any diagram", () => {
    const result = filterDiagrams(sampleDiagrams, "", "tag-nonexistent")
    expect(result).toHaveLength(0)
  })
})

describe("filterDiagrams – tag filter", () => {
  it("returns only diagrams with the given tag", () => {
    const result = filterDiagrams(sampleDiagrams, "", "tag-a")
    expect(result.map(d => d.id)).toEqual(["1", "3"])
  })

  it("works for tags with a single matching diagram", () => {
    const result = filterDiagrams(sampleDiagrams, "", "tag-b")
    expect(result.map(d => d.id)).toEqual(["2"])
  })

  it("excludes diagrams with empty tags array", () => {
    const result = filterDiagrams(sampleDiagrams, "", "tag-a")
    expect(result.find(d => d.id === "4")).toBeUndefined()
  })

  it("excludes diagrams with undefined tags", () => {
    const result = filterDiagrams(sampleDiagrams, "", "tag-a")
    expect(result.find(d => d.id === "5")).toBeUndefined()
  })
})

describe("filterDiagrams – both filters compose", () => {
  it("applies name and tag filters together (AND logic)", () => {
    // "Auth" in name AND tagged with tag-a — should return id=1 and id=3
    const result = filterDiagrams(sampleDiagrams, "auth", "tag-a")
    expect(result.map(d => d.id)).toEqual(["1", "3"])
  })

  it("returns empty when name matches but tag does not", () => {
    const result = filterDiagrams(sampleDiagrams, "auth", "tag-b")
    expect(result).toHaveLength(0)
  })

  it("returns empty when tag matches but name does not", () => {
    const result = filterDiagrams(sampleDiagrams, "payment", "tag-a")
    expect(result).toHaveLength(0)
  })
})

describe("filterDiagrams – empty query and null tagId returns all", () => {
  it("returns all diagrams when query is empty string and tagId is null", () => {
    const result = filterDiagrams(sampleDiagrams, "", null)
    expect(result).toHaveLength(sampleDiagrams.length)
  })

  it("returns all diagrams when query is undefined and tagId is null", () => {
    const result = filterDiagrams(sampleDiagrams, undefined, null)
    expect(result).toHaveLength(sampleDiagrams.length)
  })

  it("returns all diagrams when query is whitespace-only and tagId is null", () => {
    const result = filterDiagrams(sampleDiagrams, "   ", null)
    expect(result).toHaveLength(sampleDiagrams.length)
  })

  it("returns all diagrams when query is undefined and tagId is undefined", () => {
    const result = filterDiagrams(sampleDiagrams, undefined, undefined)
    expect(result).toHaveLength(sampleDiagrams.length)
  })
})
