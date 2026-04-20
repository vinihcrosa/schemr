import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types"

// ExcalidrawElement is not in the public exports map; define a compatible structural type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExcalidrawElement = { id: string; type: string } & Record<string, any>

export type ExcalidrawState = {
  elements: readonly ExcalidrawElement[]
  appState: Partial<AppState>
  files: BinaryFiles
}

export const EMPTY_DIAGRAM: ExcalidrawState = {
  elements: [],
  appState: { collaborators: new Map() },
  files: {},
}

export const MOCK_DIAGRAM: ExcalidrawState = {
  elements: [
    {
      id: "mock-rect-1",
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      angle: 0,
      strokeColor: "#1971c2",
      backgroundColor: "#d0ebff",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      seed: 1,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      index: "a0",
    },
  ],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
}

export function serializeCanvas(
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles
): ExcalidrawState {
  return { elements, appState, files }
}

export function deserializeCanvas(data: unknown): ExcalidrawState {
  if (
    data !== null &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "elements" in data &&
    Array.isArray((data as Record<string, unknown>).elements)
  ) {
    const d = data as Record<string, unknown>
    return {
      elements: (d.elements as ExcalidrawElement[]) ?? [],
      appState: (() => {
        const raw = (typeof d.appState === "object" && d.appState !== null
          ? d.appState
          : {}) as Record<string, unknown>
        // collaborators must be a Map — JSON round-trip converts it to a plain object
        if (!(raw.collaborators instanceof Map)) {
          raw.collaborators = new Map()
        }
        return raw as Partial<AppState>
      })(),
      files: (typeof d.files === "object" && d.files !== null
        ? d.files
        : {}) as BinaryFiles,
    }
  }
  return EMPTY_DIAGRAM
}
