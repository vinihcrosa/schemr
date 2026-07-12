// @vitest-environment node
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { specToExcalidraw, SpecParseError } from "@/lib/spec-to-excalidraw"
import { deserializeCanvas } from "@/lib/excalidraw"

const load = (name: string) =>
  readFileSync(resolve(__dirname, "../../fixtures/mermaid", name), "utf8")

// Types with robust node+connector support in the upstream lib.
const CONNECTOR_TYPES = ["flowchart.mmd", "sequence.mmd", "class.mmd"]
// Types that must at least convert without throwing (weaker upstream support).
const GRACEFUL_TYPES = ["er.mmd"]

describe("conversion validation suite (GEN-18/19)", () => {
  for (const file of CONNECTOR_TYPES) {
    it(`${file}: converts to a valid, binding-intact canvas (GEN-07/09/19)`, async () => {
      const state = await specToExcalidraw(load(file), "mermaid")
      // Round-trips through the load path unchanged.
      expect(deserializeCanvas(state).elements.length).toBe(
        state.elements.length
      )
      const ids = new Set(state.elements.map((e) => e.id))
      // Every binding references a real element (GEN-07).
      for (const el of state.elements) {
        for (const b of el.boundElements ?? []) {
          expect(ids.has((b as { id: string }).id)).toBe(true)
        }
        if (el.startBinding)
          expect(ids.has(el.startBinding.elementId)).toBe(true)
        if (el.endBinding) expect(ids.has(el.endBinding.elementId)).toBe(true)
      }
      // Has at least one connector.
      expect(
        state.elements.some((e) => e.type === "arrow" || e.type === "line")
      ).toBe(true)
    })

    it(`${file}: is deterministic (GEN-10)`, async () => {
      const a = await specToExcalidraw(load(file), "mermaid")
      const b = await specToExcalidraw(load(file), "mermaid")
      expect(a.elements).toEqual(b.elements)
    })
  }

  for (const file of GRACEFUL_TYPES) {
    it(`${file}: converts without throwing and deserializes (P2)`, async () => {
      const state = await specToExcalidraw(load(file), "mermaid")
      expect(deserializeCanvas(state).elements.length).toBe(
        state.elements.length
      )
    })
  }

  // KNOWN LIMITATION (documented, not a silent gap): flowcharts with edge
  // labels (`-->|text|`) fail under headless jsdom — Mermaid's label placement
  // needs real SVG path geometry we cannot supply. They surface as a graceful
  // 400 (SpecParseError), never a crash. Label-free flowcharts work fully.
  it("edge-labeled flowchart currently fails gracefully (headless limit)", async () => {
    await expect(
      specToExcalidraw("flowchart TD\n  A --> |yes| B", "mermaid")
    ).rejects.toBeInstanceOf(SpecParseError)
  })

  it("throws SpecParseError on garbage input (GEN-15)", async () => {
    await expect(
      specToExcalidraw("!!! not a diagram !!!", "mermaid")
    ).rejects.toBeInstanceOf(SpecParseError)
  })

  it("throws SpecParseError on an unsupported diagram keyword (GEN-15)", async () => {
    await expect(
      specToExcalidraw("gantt\n  title X\n  bogus", "mermaid")
    ).rejects.toBeInstanceOf(SpecParseError)
  })
})
