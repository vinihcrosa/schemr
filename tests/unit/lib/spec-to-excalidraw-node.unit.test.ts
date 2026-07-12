// @vitest-environment node
import { describe, it, expect } from "vitest"
import { specToExcalidraw } from "@/lib/spec-to-excalidraw"

// Verifies the Node/server path (no ambient DOM) — ensureDom() must build jsdom.
describe("specToExcalidraw in node env (GEN-16)", () => {
  it("converts headless with no browser/ambient DOM", async () => {
    expect((globalThis as { document?: unknown }).document).toBeUndefined()
    const state = await specToExcalidraw("flowchart TD\n  A[Start] --> B[End]", "mermaid")
    expect(state.elements.length).toBeGreaterThan(0)
    const arrows = state.elements.filter((e) => e.type === "arrow")
    expect(arrows.length).toBeGreaterThanOrEqual(1)
    const ids = new Set(state.elements.map((e) => e.id))
    for (const a of arrows) {
      expect(ids.has(a.startBinding!.elementId)).toBe(true)
      expect(ids.has(a.endBinding!.elementId)).toBe(true)
    }
  })
})
