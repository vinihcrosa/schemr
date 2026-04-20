# M3 — Listing & Navigation Specification

## Problem Statement

After M2, users can create and edit diagrams, but there is no way to find them. The index page at `/` is a placeholder. Users have no entry point for their work beyond direct URL access. M3 completes the user loop: from the index, a user can see all their diagrams, open one, create a new one, rename it, or delete it — all within one interaction from the landing page.

The backend is fully ready: `GET /api/diagrams`, `POST /api/diagrams`, `PUT /api/diagrams/:id` all exist and enforce ownership. M3 adds the missing `DELETE /api/diagrams/:id` endpoint and builds the front-end index experience on top.

## Goals

- [ ] Users land on `/` and immediately see all their diagrams (name + last updated)
- [ ] Users can open any diagram with a single click
- [ ] Users can create a new diagram from the index and land in the editor
- [ ] Users can rename a diagram inline from the index
- [ ] Users can delete a diagram with a confirmation step
- [ ] Empty state is handled gracefully when no diagrams exist

## Out of Scope

| Feature | Reason |
|---|---|
| Diagram search / filtering | Post-MVP |
| Pagination / infinite scroll | Post-MVP — single-user MVP unlikely to exceed manageable list size |
| Thumbnail previews | Post-MVP |
| Drag-to-reorder | Post-MVP |
| Sharing / public link | Post-MVP |
| Duplicate diagram | Post-MVP |
| Bulk delete | Post-MVP |

---

## User Stories

### P1: View diagram index ⭐ MVP

**User Story**: As a signed-in user, I want to see a list of all my diagrams on the home page so that I can find and open my work.

**Why P1**: The index is the primary navigation surface — without it, the product has no usable entry point after M2.

**Acceptance Criteria**:

1. WHEN an authenticated user visits `/` THEN system SHALL call `listDiagrams(userId)` directly in the server component (no API hop) and render the list
2. WHEN diagrams exist THEN each row SHALL display the diagram `name` and a human-readable `updatedAt` timestamp (e.g. "2 hours ago" or "Apr 15, 2026")
3. WHEN the list is rendered THEN diagrams SHALL be ordered by `updatedAt` descending (most recently edited first)
4. WHEN the user has no diagrams THEN system SHALL render an empty state with a prompt to create the first diagram
5. WHEN the request is unauthenticated THEN middleware SHALL redirect to `/sign-in` (existing behavior — no change needed)

**Independent Test**: Sign in → navigate to `/` → diagrams list renders with correct names and timestamps.

---

### P1: Open a diagram ⭐ MVP

**User Story**: As a user viewing the index, I want to click a diagram to open it in the editor so that I can resume my work.

**Why P1**: The index is useless without navigation to the editor. This is the core interaction.

**Acceptance Criteria**:

1. WHEN a user clicks any diagram row THEN system SHALL navigate to `/diagrams/:id` for that diagram
2. WHEN the editor page loads THEN the canvas SHALL initialize with the diagram's saved state (existing M2b behavior)
3. WHEN the diagram ID is invalid or not owned by the current user THEN the editor SHALL display a `notFound()` page (existing behavior)

**Independent Test**: Click diagram in index → land on `/diagrams/:id` → saved canvas state renders.

---

### P1: Create new diagram from index ⭐ MVP

**User Story**: As a user on the index page, I want to create a new diagram so that I can start a fresh canvas from the index without any extra navigation steps.

**Why P1**: Creation must be accessible from the entry point. Without it, users can only open existing diagrams.

**Acceptance Criteria**:

1. WHEN the index has diagrams THEN a "New Diagram" button SHALL be visible in the page header
2. WHEN the index is empty THEN the empty state SHALL include a primary "New Diagram" call-to-action
3. WHEN user clicks "New Diagram" THEN system SHALL call `POST /api/diagrams` (name: "Untitled", empty data) and navigate to `/diagrams/:id` for the newly created diagram
4. WHEN the POST request is in-flight THEN the "New Diagram" button SHALL be disabled to prevent duplicate creation
5. WHEN the POST fails THEN system SHALL show an error message and re-enable the button

**Independent Test**: Click "New Diagram" → `POST /api/diagrams` called → redirect to new `/diagrams/:id` → blank canvas renders.

---

### P1: Rename a diagram ⭐ MVP

**User Story**: As a user, I want to rename a diagram from the index so that I can give it a meaningful name after starting with "Untitled".

**Why P1**: All diagrams start as "Untitled". Without rename, the index becomes a list of identical names unusable for navigation.

**Acceptance Criteria**:

1. WHEN a user clicks a diagram's name (or a rename affordance) THEN the name SHALL become an editable inline input, pre-filled with the current name
2. WHEN the user commits the rename (pressing Enter) THEN system SHALL call `PUT /api/diagrams/:id` with `{ name: newName }` — blur alone SHALL NOT submit to avoid accidental saves when clicking delete or navigating away
3. WHEN the new name is blank or whitespace-only THEN system SHALL NOT submit the request and SHALL restore the original name
4. WHEN the rename succeeds THEN the updated name SHALL be reflected in the list immediately (optimistic update or re-fetch)
5. WHEN the rename fails THEN system SHALL display an error and restore the original name
6. WHEN the user presses Escape THEN the edit SHALL be cancelled and the original name restored without a network call

**Independent Test**: Click diagram name → type new name → press Enter → `PUT /api/diagrams/:id` called → name updates in list.

---

### P1: Delete a diagram ⭐ MVP

**User Story**: As a user, I want to delete a diagram I no longer need so that my index stays clean.

**Why P1**: Without delete, the index accumulates noise. Rename alone isn't enough for basic housekeeping.

**Acceptance Criteria**:

1. WHEN a user triggers the delete action on a diagram row THEN system SHALL show a confirmation prompt before taking any action (e.g. "Delete 'Diagram Name'? This cannot be undone.")
2. WHEN the user confirms THEN system SHALL call `DELETE /api/diagrams/:id`
3. WHEN the user cancels THEN no request SHALL be made and the diagram SHALL remain in the list
4. WHEN the delete succeeds THEN the diagram SHALL be removed from the list immediately
5. WHEN the delete fails THEN system SHALL display an error message and the diagram SHALL remain visible
6. WHEN the diagram does not belong to the current user THEN the API SHALL return `403 Forbidden` and make no DB changes

**Independent Test**: Click delete → confirm → `DELETE /api/diagrams/:id` called → row disappears from list.

---

## New API Endpoint Required

### `DELETE /api/diagrams/:id`

- **Auth**: Required
- **Response 200**: `{}` (empty body — deletion confirmed)
- **Response 401**: Unauthenticated
- **Response 403**: Diagram not found OR authenticated but not owner (opaque — mirrors `GET /api/diagrams/:id` and `PUT /api/diagrams/:id`)

**Implementation note**: Use `db.diagram.deleteMany({ where: { id, userId } })`. When `count === 0`, return `403` — matching the system-wide policy established in M2b where both "not found" and "wrong owner" collapse to `403` because `where: { id, userId }` can't distinguish them in a single query. Do not add a pre-flight `findFirst` just to return a different code — that adds a round-trip for no user-visible benefit.

---

## Edge Cases

- WHEN the user is on `/diagrams/:id` (editor) and deletes the current diagram THEN no guard is needed — the editor has no delete affordance; deletion only happens from the index
- WHEN the user renames a diagram to the same name it already has THEN the PUT request SHOULD be skipped (avoid unnecessary round-trip)
- WHEN a rename is in progress and the user navigates away THEN the pending input SHALL be abandoned without a save (no unsaved-changes guard on rename)
- WHEN the diagram list is long THEN the page SHALL remain scrollable without layout overflow issues
- WHEN a "New Diagram" POST fails due to a network error THEN no record SHALL exist in the DB (no partial state)

---

## Component Inventory

| Component | Location | Purpose |
|---|---|---|
| `DiagramIndexPage` | `app/(app)/page.tsx` | Server component — fetches list, renders index |
| `DiagramList` | `components/diagrams/DiagramList.tsx` | Client component — renders rows, handles interactions |
| `DiagramRow` | `components/diagrams/DiagramRow.tsx` | Individual row — name display, rename input, delete trigger |
| `DiagramEmptyState` | `components/diagrams/DiagramEmptyState.tsx` | Shown when list is empty |
| `NewDiagramButton` | `components/diagrams/NewDiagramButton.tsx` | Client button — calls POST, redirects |
| `DeleteConfirmDialog` | `components/diagrams/DeleteConfirmDialog.tsx` | Inline or modal confirmation before delete |

**Data flow**: `DiagramIndexPage` (server) calls `listDiagrams(userId)` directly (no API hop needed — same process). Mutations (create, rename, delete) go through API routes from client components.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| M3-01 | P1: View diagram index | Specify | Planned |
| M3-02 | P1: Open a diagram | Specify | Planned |
| M3-03 | P1: Create new diagram from index | Specify | Planned |
| M3-04 | P1: Rename a diagram | Specify | Planned |
| M3-05 | P1: Delete a diagram | Specify | Planned |

---

## Success Criteria

- [ ] `/` renders all diagrams for the authenticated user, ordered by `updatedAt` desc
- [ ] Empty state renders with a working "New Diagram" CTA when no diagrams exist
- [ ] Clicking a diagram row navigates to `/diagrams/:id` and the canvas loads
- [ ] "New Diagram" creates a record and redirects to the new editor
- [ ] Rename commits on Enter/blur, cancels on Escape, ignores blank names
- [ ] Delete shows confirmation, removes the row on success, shows error on failure
- [ ] `DELETE /api/diagrams/:id` returns 200 for owner, 403 for non-owner or missing ID (opaque — consistent with GET/PUT)
- [ ] Unauthenticated requests to `/` redirect to `/sign-in`
