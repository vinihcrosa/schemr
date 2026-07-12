import { describe, it, expect } from "vitest"
import {
  specToExcalidraw,
  normalizeDeterministic,
  SpecParseError,
} from "@/lib/spec-to-excalidraw"
import { deserializeCanvas, type ExcalidrawElement } from "@/lib/excalidraw"

const FLOW = "flowchart TD\n  A[Start] --> B[End]"

describe("specToExcalidraw", () => {
  it("converts a flowchart into full, valid elements (GEN-05/06/09)", async () => {
    const state = await specToExcalidraw(FLOW, "mermaid")
    expect(state.elements.length).toBeGreaterThan(0)
    for (const el of state.elements) {
      expect(el).toHaveProperty("index")
      expect(el).toHaveProperty("seed")
      expect(el).toHaveProperty("versionNonce")
      expect(el).toHaveProperty("version")
      expect(el).toHaveProperty("groupIds")
    }
    // Survives the load path unchanged in count.
    expect(deserializeCanvas(state).elements.length).toBe(state.elements.length)
  })

  it("keeps arrow bindings attached to real nodes (GEN-07)", async () => {
    const state = await specToExcalidraw(FLOW, "mermaid")
    const ids = new Set(state.elements.map((e) => e.id))
    const arrows = state.elements.filter((e) => e.type === "arrow")
    expect(arrows.length).toBeGreaterThanOrEqual(1)
    for (const a of arrows) {
      const s = a.startBinding?.elementId
      const e = a.endBinding?.elementId
      expect(s && ids.has(s)).toBe(true)
      expect(e && ids.has(e)).toBe(true)
      // The bound nodes reference the arrow back.
      for (const node of state.elements) {
        if (node.id === s || node.id === e) {
          const bound = (node.boundElements ?? []).map(
            (b: { id: string }) => b.id
          )
          expect(bound).toContain(a.id)
        }
      }
    }
  })

  it("no binding references a missing element id (GEN-12)", async () => {
    const state = await specToExcalidraw(FLOW, "mermaid")
    const ids = new Set(state.elements.map((e) => e.id))
    for (const el of state.elements) {
      for (const b of el.boundElements ?? []) {
        expect(ids.has((b as { id: string }).id)).toBe(true)
      }
      if (el.startBinding) expect(ids.has(el.startBinding.elementId)).toBe(true)
      if (el.endBinding) expect(ids.has(el.endBinding.elementId)).toBe(true)
    }
  })

  it("assigns strictly ascending fractional index (GEN-08)", async () => {
    const state = await specToExcalidraw(FLOW, "mermaid")
    const idx = state.elements.map((e) => e.index as string)
    const sorted = [...idx].sort()
    expect(idx).toEqual(sorted)
    expect(new Set(idx).size).toBe(idx.length)
  })

  it("is deterministic: same spec twice is deep-equal (GEN-10/11)", async () => {
    const a = await specToExcalidraw(FLOW, "mermaid")
    const b = await specToExcalidraw(FLOW, "mermaid")
    expect(a.elements).toEqual(b.elements)
    // Identity is content-derived, never time-derived.
    for (const el of a.elements) {
      expect(el.updated).toBe(0)
    }
  })

  it("throws SpecParseError on invalid syntax (GEN-15)", async () => {
    await expect(
      specToExcalidraw("this is definitely not mermaid {{{", "mermaid")
    ).rejects.toBeInstanceOf(SpecParseError)
  })

  it("throws SpecParseError on empty spec", async () => {
    await expect(specToExcalidraw("   ", "mermaid")).rejects.toBeInstanceOf(
      SpecParseError
    )
  })

  it("throws SpecParseError on unsupported format (GEN-14)", async () => {
    await expect(
      // @ts-expect-error testing the runtime guard
      specToExcalidraw(FLOW, "svg")
    ).rejects.toBeInstanceOf(SpecParseError)
  })
})

describe("normalizeDeterministic (pure)", () => {
  const els: ExcalidrawElement[] = [
    {
      id: "old-a",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      boundElements: [{ id: "old-arrow", type: "arrow" }],
      groupIds: ["g-old"],
    } as unknown as ExcalidrawElement,
    {
      id: "old-b",
      type: "rectangle",
      x: 0,
      y: 200,
      width: 100,
      height: 50,
      boundElements: [{ id: "old-arrow", type: "arrow" }],
      groupIds: ["g-old"],
    } as unknown as ExcalidrawElement,
    {
      id: "old-arrow",
      type: "arrow",
      x: 50,
      y: 50,
      width: 0,
      height: 150,
      startBinding: { elementId: "old-a", focus: 0, gap: 1 },
      endBinding: { elementId: "old-b", focus: 0, gap: 1 },
    } as unknown as ExcalidrawElement,
  ]

  it("rewrites every cross-reference to the new ids (GEN-12)", () => {
    const out = normalizeDeterministic(els)
    const ids = new Set(out.map((e) => e.id))
    const arrow = out.find((e) => e.type === "arrow")!
    expect(ids.has(arrow.startBinding!.elementId)).toBe(true)
    expect(ids.has(arrow.endBinding!.elementId)).toBe(true)
    for (const node of out.filter((e) => e.type === "rectangle")) {
      for (const b of node.boundElements ?? []) {
        expect(ids.has((b as { id: string }).id)).toBe(true)
      }
      // groupIds are remapped (here the group id is not an element id, left as-is)
      expect(node.groupIds).toBeDefined()
    }
  })

  it("is stable across runs", () => {
    expect(normalizeDeterministic(els)).toEqual(normalizeDeterministic(els))
  })

  it("gives distinct ids to same-shape elements via ordinal", () => {
    const same: ExcalidrawElement[] = [
      { id: "x", type: "rectangle", x: 0, y: 0, width: 10, height: 10, text: "N" } as unknown as ExcalidrawElement,
      { id: "y", type: "rectangle", x: 0, y: 0, width: 10, height: 10, text: "N" } as unknown as ExcalidrawElement,
    ]
    const out = normalizeDeterministic(same)
    expect(out[0].id).not.toBe(out[1].id)
  })
})
