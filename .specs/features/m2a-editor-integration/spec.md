# M2a — Editor Integration Specification

## Problem Statement

Schemr's core value is the drawing interface. Before any persistence is wired up, the Excalidraw canvas must render correctly in the Next.js App Router context, respond to user input, and produce a serializable data structure — proving the integration is sound before adding backend complexity.

Excalidraw is a client-only library: it cannot be server-side rendered. This makes the embed non-trivial in the App Router context and requires deliberate handling of dynamic imports and hydration boundaries.

## Goals

- [ ] Excalidraw canvas renders in the authenticated app without SSR errors
- [ ] User can draw on the canvas (freehand, shapes, text)
- [ ] Canvas initializes with static/mock data to validate deserialization
- [ ] Excalidraw state (elements, appState, files) serializes to a JSON-compatible structure and deserializes back without data loss
- [ ] No backend interaction in this milestone — editor behavior is validated in isolation

## Out of Scope

| Feature | Reason |
|---|---|
| Saving diagrams to backend | M2b |
| Loading diagrams by ID | M2b |
| Autosave | M2c |
| Diagram naming / title editing | M3 |
| Toolbar customization or Excalidraw config tuning | Post-MVP |

---

## User Stories

### P1: Render the Excalidraw canvas ⭐ MVP

**User Story**: As an authenticated user, I want to see the drawing canvas when I navigate to the editor so that I can start sketching immediately.

**Why P1**: The entire product depends on the canvas rendering. If this doesn't work, nothing else does.

**Acceptance Criteria**:

1. WHEN an authenticated user navigates to the editor route THEN system SHALL render the Excalidraw canvas without SSR errors or hydration mismatches
2. WHEN the canvas renders THEN it SHALL occupy the full available viewport area
3. WHEN the user opens the editor THEN the toolbar, action buttons, and zoom controls SHALL be visible and interactive
4. WHEN the page loads THEN no console errors related to Excalidraw initialization SHALL appear

**Independent Test**: Navigate to editor → canvas is visible → toolbar responds to clicks.

---

### P1: Draw on the canvas ⭐ MVP

**User Story**: As a user, I want to draw shapes and write text on the canvas so that I can create diagrams.

**Why P1**: A canvas that renders but doesn't accept input is not a drawing tool.

**Acceptance Criteria**:

1. WHEN user selects a shape tool and drags on the canvas THEN a shape SHALL appear at the drawn position
2. WHEN user selects the text tool and clicks THEN a text input SHALL open and text SHALL be placed on the canvas
3. WHEN user uses the freehand/pencil tool THEN strokes SHALL render in real time
4. WHEN user undoes an action (Ctrl+Z / Cmd+Z) THEN the last change SHALL be reverted

**Independent Test**: Draw a rectangle, add text → undo → rectangle and text removed.

---

### P1: Initialize canvas with mock data ⭐ MVP

**User Story**: As the system, I want the editor to initialize with static mock data so that deserialization of Excalidraw elements is validated before backend integration.

**Why P1**: Validates that the data contract (elements, appState, files) survives a round-trip before it's wired to real persistence.

**Acceptance Criteria**:

1. WHEN the editor mounts THEN it SHALL load a predefined set of mock Excalidraw elements
2. WHEN mock elements are loaded THEN they SHALL be visible on the canvas without visual corruption
3. WHEN mock data includes an `appState` (e.g. viewBackgroundColor, zoom) THEN those settings SHALL be applied on init
4. WHEN mock data is empty (no elements) THEN the canvas SHALL render a blank state without errors

**Independent Test**: Mount editor with mock data → shapes appear on canvas at correct positions.

---

### P1: Serialize and deserialize canvas state ⭐ MVP

**User Story**: As the system, I want Excalidraw's state to serialize to a JSON-compatible structure and deserialize back without data loss so that persistence will work correctly in M2b.

**Why P1**: The serialization contract must be validated in isolation. Discovering data loss after persistence is wired is expensive to debug.

**Acceptance Criteria**:

1. WHEN the canvas has elements THEN calling the serializer SHALL produce a JSON object with `elements`, `appState`, and `files` fields
2. WHEN that JSON is passed back to the canvas as initial data THEN all elements SHALL be restored at the same positions and with the same properties
3. WHEN elements include images/files THEN their binary data SHALL be preserved through the serialize → deserialize round-trip
4. WHEN the serialized JSON is stored in the `Diagram.data` Prisma field (type `Json`) THEN the structure SHALL be directly compatible without transformation

**Independent Test**: Draw shapes → serialize → deserialize → shapes match original.

---

## Edge Cases

- WHEN the user navigates away from the editor mid-draw THEN no error SHALL occur (no unsaved-changes guard yet — that's M2b/M2c)
- WHEN the browser window is resized THEN the canvas SHALL reflow and remain fully usable
- WHEN Excalidraw library assets (fonts, icons) fail to load THEN the canvas SHALL still render with graceful fallback (no blank page)
- WHEN the editor route is accessed on a small viewport (mobile width) THEN the canvas SHALL render without overflow or layout breakage

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| M2A-01 | P1: Render canvas | Specify | Planned |
| M2A-02 | P1: Draw on canvas | Specify | Planned |
| M2A-03 | P1: Initialize with mock data | Specify | Planned |
| M2A-04 | P1: Serialize / deserialize state | Specify | Planned |

---

## Technical Notes

- Excalidraw **must** be dynamically imported with `{ ssr: false }` — it uses browser-only APIs (`window`, `document`, canvas)
- The editor component must be wrapped in a Client Component (`"use client"`) with a `dynamic()` import boundary
- The data shape expected by Excalidraw's `initialData` prop: `{ elements: ExcalidrawElement[], appState: Partial<AppState>, files: BinaryFiles }`
- This exact shape maps to the `Diagram.data` JSON column — no transformation layer needed

---

## Success Criteria

- [ ] Authenticated user navigates to editor — canvas renders with no console errors
- [ ] User can draw shapes and text; undo works
- [ ] Canvas initializes with mock data; shapes appear correctly
- [ ] Serialize → deserialize round-trip preserves all elements and appState
