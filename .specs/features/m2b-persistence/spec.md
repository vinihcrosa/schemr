# M2b — Persistence (Manual Save) Specification

## Problem Statement

Diagrams drawn in the editor exist only in memory. Without persistence, users lose their work on every page navigation. M2b wires the Excalidraw canvas to the backend: a complete CRUD API for diagrams, enforced ownership, and explicit save/load via user action.

The `Diagram` model already exists in the Prisma schema (`id`, `name`, `data: Json`, `userId`, `createdAt`, `updatedAt`). This milestone implements all read/write paths against that model.

## Goals

- [ ] Users can create a new diagram and persist it to the database
- [ ] Users can save changes to an existing diagram via an explicit save action
- [ ] Users can load a previously saved diagram by navigating to its route
- [ ] All diagram endpoints enforce ownership — users can only access their own diagrams
- [ ] API covers the full CRUD surface needed by M3 (list, get, create, update)

## Out of Scope

| Feature | Reason |
|---|---|
| Autosave / debounced save | M2c |
| Diagram deletion | M3 — Diagram Management |
| Diagram rename via editor | M3 — Diagram Management |
| Sharing / public links | Post-MVP |
| Optimistic updates / save indicator animation | M2c (UX refinement) |
| Payload size enforcement beyond what Postgres handles | Post-MVP |

---

## User Stories

### P1: Create a new diagram ⭐ MVP

**User Story**: As a signed-in user, I want to create a new diagram so that I can start a fresh canvas that persists my work.

**Why P1**: Entry point for all diagram work — without create, nothing else in the persistence flow can be tested.

**Acceptance Criteria**:

1. WHEN a user triggers "New Diagram" THEN system SHALL call `POST /api/diagrams` and create a `Diagram` record with `name: "Untitled"` and empty `data`
2. WHEN creation succeeds THEN system SHALL navigate the user to the editor route for the new diagram (e.g. `/diagrams/:id`)
3. WHEN the request is unauthenticated THEN system SHALL return `401 Unauthorized` and no record SHALL be created
4. WHEN `data` is omitted from the request body THEN system SHALL default to an empty Excalidraw state (valid `{ elements: [], appState: {}, files: {} }`)

**Independent Test**: Authenticated POST to `/api/diagrams` → 201 response with `id` → record exists in DB.

---

### P1: Save changes to a diagram ⭐ MVP

**User Story**: As a user editing a diagram, I want to click a Save button to persist the current canvas state so that my work is not lost.

**Why P1**: Core persistence action — without save, the product has no lasting value.

**Acceptance Criteria**:

1. WHEN user clicks the Save button THEN system SHALL call `PUT /api/diagrams/:id` with the current serialized canvas state
2. WHEN the update succeeds THEN `Diagram.data` and `Diagram.updatedAt` SHALL be updated in the database
3. WHEN the save is in progress THEN the Save button SHALL be disabled to prevent duplicate requests
4. WHEN the save succeeds THEN the UI SHALL provide visible feedback (e.g. "Saved" label or brief confirmation)
5. WHEN the save fails (network error, 5xx) THEN the UI SHALL show an error state and the button SHALL re-enable to allow retry
6. WHEN the diagram ID does not belong to the current user THEN system SHALL return `403 Forbidden` and make no changes

**Independent Test**: Edit canvas → click Save → `PUT /api/diagrams/:id` called → DB record updated.

---

### P1: Load a diagram by ID ⭐ MVP

**User Story**: As a user, I want to navigate to a diagram's URL and have the canvas load my previously saved work so that I can continue where I left off.

**Why P1**: Without load, save is meaningless — users can't access what they saved.

**Acceptance Criteria**:

1. WHEN user navigates to `/diagrams/:id` THEN system SHALL call `GET /api/diagrams/:id` and initialize the canvas with the returned `data`
2. WHEN the diagram exists and belongs to the current user THEN the response SHALL return the full diagram including `id`, `name`, `data`, `updatedAt`
3. WHEN the diagram does not exist THEN system SHALL return `404 Not Found` and the UI SHALL display an appropriate error state
4. WHEN the diagram belongs to a different user THEN system SHALL return `403 Forbidden` (not `404` — prevents enumeration)
5. WHEN the canvas initializes from loaded data THEN all previously saved elements SHALL appear at their correct positions

**Independent Test**: Save diagram → navigate away → navigate back to `/diagrams/:id` → saved elements visible.

---

### P1: List diagrams for current user ⭐ MVP

**User Story**: As a user, I want to retrieve all my diagrams via the API so that the diagram index (M3) can display them.

**Why P1**: The list endpoint is the data source for M3's Diagram Index. Must be built and validated here.

**Acceptance Criteria**:

1. WHEN an authenticated user calls `GET /api/diagrams` THEN system SHALL return only diagrams owned by that user
2. WHEN the response is returned THEN each item SHALL include `id`, `name`, and `updatedAt` (full `data` is NOT included in the list — performance)
3. WHEN the user has no diagrams THEN system SHALL return an empty array `[]` with status `200`
4. WHEN the request is unauthenticated THEN system SHALL return `401 Unauthorized`
5. WHEN user A is authenticated THEN they SHALL NOT see any diagrams belonging to user B

**Independent Test**: User A creates 2 diagrams, user B creates 1 → `GET /api/diagrams` as user A returns exactly 2 items, none from user B.

---

### P1: Ownership enforcement ⭐ MVP

**User Story**: As the system, I want all diagram endpoints to enforce ownership so that users can only read and write their own data.

**Why P1**: Without ownership enforcement, any authenticated user can access or corrupt any diagram.

**Acceptance Criteria**:

1. WHEN `userId` is extracted on any diagram endpoint THEN it SHALL come from the server-side session only — never from the request body or query params
2. WHEN a `GET /api/diagrams/:id` request targets a diagram owned by another user THEN system SHALL return `403 Forbidden`
3. WHEN a `PUT /api/diagrams/:id` request targets a diagram owned by another user THEN system SHALL return `403 Forbidden` and make no DB changes
4. WHEN a diagram endpoint receives an invalid (non-existent) ID THEN system SHALL return `404 Not Found` regardless of auth state

**Independent Test**: Authenticated as user A → attempt `GET /api/diagrams/:id` with user B's diagram ID → `403`.

---

## Edge Cases

- WHEN the serialized Excalidraw JSON is very large (many elements, embedded images) THEN the API SHALL accept payloads up to the Postgres JSON column limit without artificial truncation
- WHEN a `PUT` request body is missing `data` THEN system SHALL return `400 Bad Request` — not silently clear the diagram
- WHEN two `PUT` requests for the same diagram arrive simultaneously THEN the last write wins (no optimistic locking in v1)
- WHEN the database is unreachable during a save THEN system SHALL return `503` and the UI SHALL display a save error
- WHEN the user navigates away with unsaved changes THEN no guard is shown yet (that's M2c — edge case noted for UX)

---

## API Contract

### `POST /api/diagrams`
- **Auth**: Required
- **Body**: `{ name?: string, data?: ExcalidrawState }` — both optional
- **Response 201**: `{ id, name, data, userId, createdAt, updatedAt }`
- **Response 401**: Unauthenticated

### `GET /api/diagrams`
- **Auth**: Required
- **Response 200**: `[{ id, name, updatedAt }]` — `data` excluded
- **Response 401**: Unauthenticated

### `GET /api/diagrams/:id`
- **Auth**: Required
- **Response 200**: `{ id, name, data, updatedAt }`
- **Response 401**: Unauthenticated
- **Response 403**: Authenticated but not owner
- **Response 404**: Diagram not found

### `PUT /api/diagrams/:id`
- **Auth**: Required
- **Body**: `{ name?: string, data?: ExcalidrawState }` — at least one required
- **Response 200**: `{ id, name, data, updatedAt }`
- **Response 400**: Missing or invalid body
- **Response 401**: Unauthenticated
- **Response 403**: Authenticated but not owner
- **Response 404**: Diagram not found

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| M2B-01 | P1: Create a new diagram | Specify | Planned |
| M2B-02 | P1: Save changes (PUT) | Specify | Planned |
| M2B-03 | P1: Load a diagram by ID | Specify | Planned |
| M2B-04 | P1: List diagrams | Specify | Planned |
| M2B-05 | P1: Ownership enforcement | Specify | Planned |

---

## Success Criteria

- [ ] `POST /api/diagrams` creates a record; unauthenticated → 401
- [ ] `PUT /api/diagrams/:id` updates `data` and `updatedAt`; wrong owner → 403
- [ ] `GET /api/diagrams/:id` returns diagram with full `data`; wrong owner → 403
- [ ] `GET /api/diagrams` returns only the current user's diagrams, without `data` field
- [ ] Save button in editor triggers PUT and shows success/error feedback
- [ ] Navigating to `/diagrams/:id` loads saved canvas state
