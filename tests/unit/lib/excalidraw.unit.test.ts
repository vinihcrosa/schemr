import { describe, it, expect } from "vitest"
import {
  serializeCanvas,
  deserializeCanvas,
  EMPTY_DIAGRAM,
  MOCK_DIAGRAM,
  type ExcalidrawState,
} from "@/lib/excalidraw"

const elements = MOCK_DIAGRAM.elements
const appState = MOCK_DIAGRAM.appState
const files = MOCK_DIAGRAM.files

describe("serializeCanvas", () => {
  it("returns object with elements, appState, and files", () => {
    const result = serializeCanvas(elements, appState, files)
    expect(result).toHaveProperty("elements")
    expect(result).toHaveProperty("appState")
    expect(result).toHaveProperty("files")
  })
})

describe("deserializeCanvas", () => {
  it("returns object with elements.length > 0 for MOCK_DIAGRAM", () => {
    const result = deserializeCanvas(MOCK_DIAGRAM)
    expect(result.elements.length).toBeGreaterThan(0)
  })

  it("returns EMPTY_DIAGRAM for null input", () => {
    const result = deserializeCanvas(null)
    expect(result).toEqual(EMPTY_DIAGRAM)
  })

  it("returns EMPTY_DIAGRAM for empty object", () => {
    const result = deserializeCanvas({})
    expect(result).toEqual(EMPTY_DIAGRAM)
  })

  it("returns object with empty elements for EMPTY_DIAGRAM", () => {
    const result = deserializeCanvas(EMPTY_DIAGRAM)
    expect(result.elements).toEqual([])
  })

  it("preserves elements through round-trip", () => {
    const serialized: ExcalidrawState = serializeCanvas(elements, appState, files)
    const deserialized = deserializeCanvas(serialized)
    expect(deserialized.elements).toEqual(elements)
  })
})
