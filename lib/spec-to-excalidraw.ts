import { createHash } from "node:crypto"
import {
  deserializeCanvas,
  EMPTY_DIAGRAM,
  type ExcalidrawElement,
  type ExcalidrawState,
} from "@/lib/excalidraw"

export type SupportedFormat = "mermaid"

/** Thrown when a spec is unsupported, unparseable, or yields nothing. Message is client-safe. */
export class SpecParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SpecParseError"
  }
}

// ---------------------------------------------------------------------------
// Headless DOM (context.md D1)
// ---------------------------------------------------------------------------
// `@excalidraw/mermaid-to-excalidraw` drives the `mermaid` library, which needs
// a DOM and SVG text metrics to lay out nodes. We provide both server-side.
//
// NOTE (T1 spike finding): we deliberately do NOT use `@excalidraw/excalidraw`'s
// `convertToExcalidrawElements`. Importing that package evaluates the entire
// editor (React dialogs that self-initialize), which cannot run outside a
// browser. Instead we convert the Mermaid *skeleton* (which is pure geometry)
// into fully-qualified Excalidraw elements ourselves — headless and testable.
function patchSvgMetrics(win: Record<string, unknown>): void {
  const textLen = function (this: { textContent?: string | null }) {
    return (this.textContent ?? "").length * 8
  }
  const bbox = function (this: { textContent?: string | null }) {
    const width = (this.textContent ?? "").length * 8
    return { x: 0, y: 0, width, height: 16 }
  }
  const svgProto = (win.SVGElement as
    | { prototype: Record<string, unknown> }
    | undefined)?.prototype
  if (svgProto) {
    svgProto.getComputedTextLength = textLen
    svgProto.getBBox = bbox
  }
  const elProto = (win.Element as
    | { prototype: Record<string, unknown> }
    | undefined)?.prototype
  if (elProto) elProto.getBBox = bbox
}

let domReady = false
async function ensureDom(): Promise<void> {
  if (domReady) return
  const g = globalThis as unknown as Record<string, unknown>
  if (typeof g.document !== "undefined" && typeof g.window !== "undefined") {
    patchSvgMetrics(g)
    domReady = true
    return
  }
  const { JSDOM } = await import("jsdom")
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    pretendToBeVisual: true,
  })
  const w = dom.window as unknown as Record<string, unknown>
  g.window = w
  g.document = w.document
  for (const k of [
    "DOMParser",
    "Node",
    "Element",
    "HTMLElement",
    "SVGElement",
    "getComputedStyle",
  ]) {
    g[k] = w[k]
  }
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: w.navigator,
      configurable: true,
    })
  } catch {
    // Node ≥21 exposes a read-only global navigator; leave it.
  }
  patchSvgMetrics(w)
  domReady = true
}

// ---------------------------------------------------------------------------
// Skeleton → full Excalidraw elements (pure)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sk = Record<string, any>

const num = (v: unknown, d = 0): number => (typeof v === "number" ? v : d)

// Shared defaults every Excalidraw element requires to render.
function baseFields(): Partial<ExcalidrawElement> {
  return {
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    boundElements: null,
    link: null,
    locked: false,
    isDeleted: false,
  }
}

/**
 * Convert the Mermaid skeleton into fully-qualified Excalidraw elements with
 * container↔label and arrow↔node bindings wired. Pure — no DOM, no DB. Ids here
 * are the (already stable) Mermaid ids; identity is finalized in
 * `normalizeDeterministic`.
 */
export function convertSkeleton(skeleton: readonly Sk[]): ExcalidrawElement[] {
  const out: ExcalidrawElement[] = []
  // node id -> list of bound element refs (labels + arrows)
  const bound = new Map<string, { id: string; type: string }[]>()
  const addBound = (nodeId: string, ref: { id: string; type: string }) => {
    if (!bound.has(nodeId)) bound.set(nodeId, [])
    bound.get(nodeId)!.push(ref)
  }

  // Pass 1: shapes + their text labels
  for (const el of skeleton) {
    if (el.type === "arrow" || el.type === "line") continue
    const id = String(el.id)
    const width = num(el.width, 100)
    const height = num(el.height, 40)
    const shape: ExcalidrawElement = {
      ...baseFields(),
      id,
      type: el.type,
      x: num(el.x),
      y: num(el.y),
      width,
      height,
      strokeWidth: num(el.strokeWidth, 2),
      roundness: el.type === "rectangle" ? { type: 3 } : null,
    } as ExcalidrawElement

    if (el.label && typeof el.label.text === "string") {
      const textId = `${id}__label`
      const fontSize = num(el.label.fontSize, 20)
      const text = el.label.text
      const textEl: ExcalidrawElement = {
        ...baseFields(),
        id: textId,
        type: "text",
        x: num(el.x) + 5,
        y: num(el.y) + Math.max(0, (height - fontSize) / 2),
        width: Math.max(1, text.length * (fontSize * 0.5)),
        height: fontSize * 1.25,
        text,
        originalText: text,
        fontSize,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1.25,
        autoResize: true,
        containerId: id,
      } as ExcalidrawElement
      addBound(id, { id: textId, type: "text" })
      out.push(shape)
      out.push(textEl)
    } else {
      out.push(shape)
    }
  }

  const shapeIds = new Set(out.map((e) => e.id))

  // Pass 2: arrows/lines with bindings
  for (const el of skeleton) {
    if (el.type !== "arrow" && el.type !== "line") continue
    const id = String(el.id)
    const points: [number, number][] = Array.isArray(el.points)
      ? el.points.map((p: number[]) => [num(p[0]), num(p[1])])
      : [
          [0, 0],
          [0, 0],
        ]
    const startId = el.start?.id != null ? String(el.start.id) : undefined
    const endId = el.end?.id != null ? String(el.end.id) : undefined
    const xs = points.map((p) => p[0])
    const ys = points.map((p) => p[1])
    const arrow: ExcalidrawElement = {
      ...baseFields(),
      id,
      type: el.type,
      x: num(el.x),
      y: num(el.y),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      strokeWidth: num(el.strokeWidth, 2),
      points,
      lastCommittedPoint: null,
      roundness: el.roundness ?? { type: 2 },
      startArrowhead: null,
      endArrowhead: el.type === "arrow" ? "arrow" : null,
      startBinding:
        startId && shapeIds.has(startId)
          ? { elementId: startId, focus: 0, gap: 4 }
          : null,
      endBinding:
        endId && shapeIds.has(endId)
          ? { elementId: endId, focus: 0, gap: 4 }
          : null,
    } as ExcalidrawElement
    if (startId && shapeIds.has(startId))
      addBound(startId, { id, type: el.type })
    if (endId && shapeIds.has(endId)) addBound(endId, { id, type: el.type })
    out.push(arrow)
  }

  // Attach accumulated boundElements to each shape.
  for (const e of out) {
    const refs = bound.get(e.id)
    if (refs && refs.length) e.boundElements = refs
  }
  return out
}

// ---------------------------------------------------------------------------
// Deterministic identity (context.md D2, GEN-08/10/11/12)
// ---------------------------------------------------------------------------
function intFromHash(hex: string, offset: number): number {
  return parseInt(hex.slice(offset, offset + 8), 16) & 0x7fffffff
}

/**
 * Assign content-derived id/seed/versionNonce/index so the same spec always
 * yields byte-identical output, and rewrite every cross-reference so no binding
 * dangles. Pure — no DOM, no DB.
 */
export function normalizeDeterministic(
  elements: readonly ExcalidrawElement[]
): ExcalidrawElement[] {
  const idMap = new Map<string, string>()
  const withKeys = elements.map((el, i) => {
    const round = (n: unknown) => (typeof n === "number" ? Math.round(n) : 0)
    const key = createHash("sha256")
      .update(
        [
          el.type,
          round(el.x),
          round(el.y),
          round(el.width),
          round(el.height),
          typeof el.text === "string" ? el.text : "",
          i,
        ].join("|")
      )
      .digest("hex")
    idMap.set(el.id, key.slice(0, 16))
    return { el, key, ordinal: i }
  })

  const remap = (id: unknown): string | undefined =>
    typeof id === "string" && idMap.has(id) ? idMap.get(id) : undefined

  return withKeys.map(({ el, key, ordinal }) => {
    const next: ExcalidrawElement = {
      ...el,
      id: idMap.get(el.id)!,
      seed: intFromHash(key, 0),
      versionNonce: intFromHash(key, 8),
      version: 1,
      updated: 0,
      index: `a${ordinal}`,
    }
    if (Array.isArray(el.boundElements)) {
      const rewritten = el.boundElements
        .map((b: { id: string; type: string }) => {
          const nid = remap(b.id)
          return nid ? { ...b, id: nid } : null
        })
        .filter((b): b is { id: string; type: string } => b !== null)
      next.boundElements = rewritten.length ? rewritten : null
    }
    if (el.startBinding && typeof el.startBinding === "object") {
      const nid = remap(el.startBinding.elementId)
      next.startBinding = nid
        ? { ...el.startBinding, elementId: nid }
        : null
    }
    if (el.endBinding && typeof el.endBinding === "object") {
      const nid = remap(el.endBinding.elementId)
      next.endBinding = nid ? { ...el.endBinding, elementId: nid } : null
    }
    if (typeof el.containerId === "string") {
      next.containerId = remap(el.containerId) ?? null
    }
    if (Array.isArray(el.groupIds)) {
      next.groupIds = el.groupIds.map((g: string) => remap(g) ?? g)
    }
    if (typeof el.frameId === "string") {
      next.frameId = remap(el.frameId) ?? null
    }
    return next
  })
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------
/**
 * Convert a spec into a valid, deterministic ExcalidrawState.
 * Throws SpecParseError on unsupported format, parse failure, or empty result.
 */
export async function specToExcalidraw(
  spec: string,
  format: SupportedFormat
): Promise<ExcalidrawState> {
  if (format !== "mermaid") {
    throw new SpecParseError(`Unsupported format: ${String(format)}`)
  }
  if (typeof spec !== "string" || spec.trim().length === 0) {
    throw new SpecParseError("Spec is empty")
  }

  await ensureDom()

  const { parseMermaidToExcalidraw } = await import(
    "@excalidraw/mermaid-to-excalidraw"
  )

  let skeleton: readonly Sk[]
  let files: Record<string, unknown> | undefined
  try {
    const result = await parseMermaidToExcalidraw(spec, { fontSize: 16 })
    skeleton = result.elements as unknown as Sk[]
    files = result.files as Record<string, unknown> | undefined
  } catch (err) {
    throw new SpecParseError(
      "Invalid Mermaid syntax: " +
        (err instanceof Error ? err.message.split("\n")[0] : "parse error")
    )
  }

  if (!skeleton || skeleton.length === 0) {
    throw new SpecParseError("Spec produced no elements")
  }

  const full = convertSkeleton(skeleton)
  if (full.length === 0) {
    throw new SpecParseError("Spec produced no elements")
  }
  const normalized = normalizeDeterministic(full)

  const state: ExcalidrawState = {
    elements: normalized,
    appState: { ...EMPTY_DIAGRAM.appState, viewBackgroundColor: "#ffffff" },
    files: (files ?? {}) as ExcalidrawState["files"],
  }

  // Sanity: the persisted shape must round-trip through the load path.
  const roundTripped = deserializeCanvas(state)
  if (roundTripped.elements.length !== normalized.length) {
    throw new SpecParseError("Conversion produced an invalid canvas")
  }
  return { ...state, elements: roundTripped.elements }
}
