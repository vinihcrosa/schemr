# M4 — Editor Sidebar Specification

## Problem Statement

After M3, switching diagrams requires navigating back to `/`, finding the diagram in the list, and opening it — three steps interrupted by a full page transition away from the canvas. The editor has no persistent navigation context: once you're inside a diagram, your other diagrams are invisible.

M4 embeds the diagram list directly inside the editor as a collapsible left sidebar. Users can switch diagrams, create new ones, rename and delete — all without leaving the canvas. The `/` index page is also reworked: it becomes a redirect to the most recent diagram, or a minimal landing screen when no diagrams exist.

## Goals

- [ ] A collapsible sidebar is visible in the Excalidraw editor at all times
- [ ] The sidebar lists all user diagrams; the current one is visually highlighted
- [ ] Clicking any diagram in the sidebar navigates to it without a full-page reload
- [ ] A "New Diagram" action in the sidebar creates and navigates to a new diagram
- [ ] Diagrams can be renamed inline from the sidebar (edit icon per item)
- [ ] Diagrams can be deleted from the sidebar via two-step icon confirmation (click → pending state → click again → delete)
- [ ] Collapsing the sidebar shows only the toggle icon, giving back canvas space
- [ ] `/` redirects to the most recently edited diagram, or shows a minimal "no diagrams" screen

## Out of Scope

| Feature | Reason |
|---|---|
| Sidebar on pages other than the editor | M4 scope is the editor only |
| Drag to reorder diagrams in sidebar | Post-MVP |
| Folder organization in sidebar | M5 |
| Diagram search / filter in sidebar | Post-MVP |
| Keyboard shortcuts for sidebar actions | Post-MVP |

---

## User Stories

### P1: Persistent sidebar in the editor ⭐ MVP

**User Story**: As a user editing a diagram, I want to see my other diagrams in a sidebar so that I can switch between them without leaving the editor.

**Why P1**: Core of M4. Without this, everything else in this milestone has no surface to live on.

**Acceptance Criteria**:

1. WHEN a user navigates to `/diagrams/:id` THEN a sidebar SHALL be rendered to the left of the Excalidraw canvas, outside the canvas bounds (flex row — canvas shrinks, not covered)
2. WHEN the sidebar is expanded THEN it SHALL display the names of all diagrams belonging to the current user, ordered by `updatedAt` descending
3. WHEN the sidebar is expanded THEN the currently open diagram SHALL be visually distinguished from the others (highlighted background, different text weight, or similar)
4. WHEN the user has no other diagrams THEN the sidebar SHALL show only the current diagram in the list
5. WHEN the sidebar is rendered THEN it SHALL not interfere with Excalidraw's own toolbar or UI elements — the canvas area starts after the sidebar

**Independent Test**: Open any diagram → sidebar visible on the left → list shows all user diagrams → current diagram highlighted.

---

### P1: Collapse and expand sidebar ⭐ MVP

**User Story**: As a user who wants more canvas space, I want to collapse the sidebar so that only a toggle icon remains visible.

**Why P1**: The sidebar permanently reduces canvas width. Without collapse, it's a net negative for focused work.

**Acceptance Criteria**:

1. WHEN the sidebar is expanded THEN a toggle button SHALL be visible to collapse it
2. WHEN the user clicks the toggle THEN the sidebar SHALL collapse to show only the toggle icon (no diagram list, no labels)
3. WHEN the sidebar is collapsed THEN the Excalidraw canvas SHALL expand to fill the recovered space
4. WHEN the user clicks the toggle again THEN the sidebar SHALL expand back to full width
5. WHEN the user reloads or navigates between diagrams THEN the sidebar SHALL restore its last state (collapsed or expanded) — persisted in `localStorage`

**Independent Test**: Expand sidebar → toggle → collapses to icon only → canvas fills space → toggle again → expands → reload → state preserved.

---

### P1: Switch diagrams from sidebar ⭐ MVP

**User Story**: As a user editing a diagram, I want to click another diagram in the sidebar to open it immediately, without navigating away to the index page first.

**Why P1**: This is the primary value of M4 — frictionless diagram switching.

**Acceptance Criteria**:

1. WHEN a user clicks a diagram item in the sidebar THEN the browser SHALL navigate to `/diagrams/:id` for that diagram
2. WHEN navigation completes THEN the newly opened diagram's canvas state SHALL load correctly (existing M2b behavior)
3. WHEN navigation completes THEN the sidebar SHALL update to highlight the newly active diagram
4. WHEN the user clicks the currently active diagram in the sidebar THEN nothing SHALL happen (no reload)

**Independent Test**: Open diagram A → sidebar shows diagram B → click B → navigate to `/diagrams/B-id` → B's canvas loads → B is highlighted in sidebar.

---

### P1: Create new diagram from sidebar ⭐ MVP

**User Story**: As a user editing a diagram, I want to create a new diagram from the sidebar so that I can start a fresh canvas without going back to the index page.

**Why P1**: Creation is the other side of navigation — without it, users must leave the editor to start new work.

**Acceptance Criteria**:

1. WHEN the sidebar is expanded THEN a "New Diagram" button (or "+" icon) SHALL be visible, separate from the diagram list
2. WHEN the user clicks "New Diagram" THEN system SHALL call `POST /api/diagrams` and navigate to the new diagram's editor
3. WHEN the POST is in-flight THEN the button SHALL be disabled to prevent duplicate creation
4. WHEN the new diagram is created and the editor loads THEN the sidebar SHALL show the new diagram at the top of the list, highlighted as the current one
5. WHEN the POST fails THEN the button SHALL re-enable and show an error indicator

**Independent Test**: Click "New Diagram" in sidebar → POST fires → navigate to new `/diagrams/:id` → new diagram appears at top of sidebar list, highlighted.

---

### P1: Rename diagram from sidebar ⭐ MVP

**User Story**: As a user, I want to rename a diagram directly from the sidebar by clicking an edit icon next to its name.

**Why P1**: All diagrams start as "Untitled". Rename must be accessible from wherever the list lives.

**Acceptance Criteria**:

1. WHEN the user hovers a diagram item THEN an edit (pencil) icon SHALL appear next to the name
2. WHEN the user clicks the edit icon THEN the diagram name SHALL become an inline editable input, pre-filled with the current name
3. WHEN the user presses Enter THEN system SHALL call `PUT /api/diagrams/:id { name }` and update the name in the sidebar
4. WHEN the new name is blank or whitespace-only THEN the request SHALL NOT be sent and the original name SHALL be restored
5. WHEN the new name equals the current name THEN the request SHALL NOT be sent
6. WHEN the user presses Escape THEN the edit SHALL be cancelled and the original name restored
7. WHEN the rename fails THEN the original name SHALL be restored in the sidebar

**Independent Test**: Hover diagram item → click edit icon → type new name → Enter → `PUT` fires → name updates in sidebar.

---

### P1: Delete diagram from sidebar ⭐ MVP

**User Story**: As a user, I want to delete a diagram from the sidebar with a lightweight confirmation so that accidental clicks don't destroy work.

**Why P1**: Housekeeping must be accessible from the sidebar, not just the index page.

**Acceptance Criteria**:

1. WHEN the user hovers a diagram item THEN a delete (trash) icon SHALL appear next to the name
2. WHEN the user clicks the delete icon once THEN the icon SHALL enter a "pending confirmation" state (e.g. turns red, shows a tooltip "Click again to delete") — no request is sent yet
3. WHEN the user clicks the delete icon a second time THEN system SHALL call `DELETE /api/diagrams/:id`
4. WHEN the user clicks anywhere else after the first click THEN the pending state SHALL be cancelled with no request sent
5. WHEN the delete succeeds THEN the diagram SHALL be removed from the sidebar list
6. WHEN the deleted diagram is the currently open one THEN system SHALL navigate to the most recent remaining diagram, or to the "no diagrams" screen if none remain
7. WHEN the delete fails THEN the diagram SHALL remain in the sidebar and an error indicator SHALL appear
8. WHEN the diagram does not belong to the current user THEN the API SHALL return `403` (existing behavior)

**Independent Test**: Hover diagram → click delete once → icon turns red → click again → `DELETE` fires → item removed → if current diagram, navigate away.

---

### P1: Rework `/` index route ⭐ MVP

**User Story**: As a user, I want navigating to `/` to take me directly into my most recent diagram (or a create screen if I have none) — not a standalone listing page.

**Why P1**: The M3 index page becomes redundant once the sidebar is the primary navigation surface. Keeping both creates two sources of truth for the same list.

**Acceptance Criteria**:

1. WHEN an authenticated user navigates to `/` AND they have at least one diagram THEN system SHALL redirect to `/diagrams/:id` of the most recently updated diagram
2. WHEN an authenticated user navigates to `/` AND they have no diagrams THEN system SHALL render a minimal screen with a single "Create your first diagram" CTA
3. WHEN the "Create your first diagram" CTA is clicked THEN system SHALL call `POST /api/diagrams` and navigate to the new editor
4. WHEN an unauthenticated user navigates to `/` THEN middleware SHALL redirect to `/sign-in` (existing behavior — no change)

**Independent Test**: Sign in with existing diagrams → navigate to `/` → redirected to most recent `/diagrams/:id`. Sign in with no diagrams → `/` shows create screen.

---

### P1: Resize sidebar width ⭐ MVP

**User Story**: As a user, I want to drag the sidebar's right edge to adjust its width so that I can balance navigation space against canvas space to my preference.

**Why P1**: A fixed-width sidebar serves some diagram names well and others poorly. Without resize, long names are always truncated and short names waste space.

**Acceptance Criteria**:

1. WHEN the user hovers over the right edge of the expanded sidebar THEN a resize cursor (`col-resize`) SHALL appear, indicating the edge is draggable
2. WHEN the user drags the right edge THEN the sidebar width SHALL update in real time, clamped to a minimum of 180px
3. WHEN the user releases the drag THEN the new width SHALL be persisted in `localStorage`
4. WHEN the user reloads or navigates between diagrams THEN the sidebar SHALL restore its last width
5. WHEN the sidebar is collapsed THEN the resize handle SHALL not be visible or interactive

**Independent Test**: Drag right edge of sidebar → width changes live → release → reload → same width restored.

---

## Layout Change

The editor page layout changes from a full-screen canvas to a flex-row split:

```
┌──────────────────────────────────────────────┐
│ [Sidebar]  │  [Excalidraw Canvas]             │
│            │                                  │
│ expanded:  │  canvas fills remaining width    │
│ resizable  │  (drag handle on right edge)     │
│ min 180px  │                                  │
│            │                                  │
│ collapsed: │  canvas fills full width         │
│ ~40px      │  (toggle icon only)              │
└──────────────────────────────────────────────┘
```

**Sidebar width**: user-resizable via a drag handle on the right edge. Minimum width: 180px (prevents the sidebar from becoming unreadable). Default width: 220px. Width persisted in `localStorage` alongside collapse state.

The sidebar is a server-rendered wrapper with a client component inside. The diagram list is fetched server-side (passed as props to the client sidebar component), so the initial render has no loading flicker.

---

## Component Inventory

| Component | Location | Purpose |
|---|---|---|
| `DiagramSidebar` | `components/sidebar/DiagramSidebar.tsx` | Client component — collapse state, list, all interactions |
| `SidebarItem` | `components/sidebar/SidebarItem.tsx` | Single diagram row — rename mode, delete, navigation |
| Update `app/(app)/diagrams/[id]/page.tsx` | existing | Add sidebar to layout; fetch list alongside diagram |
| Update `app/(app)/page.tsx` | existing | Replace list with redirect logic |

**Data flow**:
- `[id]/page.tsx` (server) fetches `getDiagramById` + `listDiagrams` in parallel → passes `diagram`, `diagrams[]`, and `currentId` as props
- `DiagramSidebar` (client) receives the list as initial state, handles all mutations locally
- Collapse state persisted in `localStorage` key `schemr:sidebar:collapsed`

---

## Relationship to M3

M3 components (`DiagramList`, `DiagramRow`) are superseded by `DiagramSidebar` + `SidebarItem`. They are **not deleted in this PR** — leave them in place until M4 is stable in production, then remove in a cleanup pass. No formal task or comments required; this is a rollout note, not a deliverable.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Sidebar position | Left, outside canvas (flex row) | Canvas tools remain accessible; no overlap |
| Collapse persistence | `localStorage` | Survives navigation between diagrams; no server round-trip needed |
| Delete confirmation | Double-click on icon (turns red + tooltip on first click) | Prevents accidental deletion; fast enough for intentional deletes |
| Sidebar width | Resizable, min 180px, default 220px, persisted in localStorage | User controls their workspace; minimum prevents unusable state |
| List fetch | Server-side on `[id]/page.tsx` | No loading flicker on initial render; list is ready when canvas loads |
| Rename commit | Enter only (not blur) | Same reasoning as M3 — blur fires on unrelated clicks |
| Delete of current diagram | Navigate to most recent remaining | Avoids dead state (editor open with no diagram) |
| M3 components | Dead code, not deleted | Kept until M4 is stable in production; documented with comment |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| M4-01 | P1: Persistent sidebar in editor | Specify | Planned |
| M4-02 | P1: Collapse and expand | Specify | Planned |
| M4-03 | P1: Switch diagrams | Specify | Planned |
| M4-04 | P1: Create new diagram | Specify | Planned |
| M4-05 | P1: Rename from sidebar | Specify | Planned |
| M4-06 | P1: Delete from sidebar | Specify | Planned |
| M4-07 | P1: Rework `/` index route | Specify | Planned |
| M4-08 | P1: Resize sidebar width | Specify | Planned |

---

## Success Criteria

- [ ] Sidebar renders to the left of the canvas on `/diagrams/:id`; canvas shrinks to fill remaining space
- [ ] Sidebar collapses to icon-only; canvas expands; state persists across reloads
- [ ] Clicking a sidebar item navigates to that diagram and highlights it
- [ ] "New Diagram" creates a diagram and navigates to it; appears at top of sidebar
- [ ] Rename: edit icon → input → Enter commits, Escape cancels, blank/unchanged → no request
- [ ] Delete: delete icon → pending state (red + tooltip) → second click → DELETE → item removed; if current diagram, navigate away
- [ ] `/` with diagrams → redirects to most recent; without diagrams → shows create screen
- [ ] Sidebar right edge is draggable; width clamped to ≥180px; persisted and restored across reloads
