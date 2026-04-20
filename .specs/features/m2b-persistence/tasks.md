# M2b — Persistence (Manual Save) Tasks

**Design**: `.specs/features/m2b-persistence/design.md`
**Status**: Planned

**Prerequisite**: M2a complete — `lib/excalidraw.ts`, `ExcalidrawEditor`, and `/diagrams/[id]/page.tsx` (mock version) all exist.

---

## Execution Plan

### Phase 1: Data Layer (Sequential)

Service helpers must exist before route handlers can use them.

```
T1 → T2
```

### Phase 2: API Routes (Parallel after T2)

All four routes depend only on `lib/diagrams.ts` (T2) and each other's integration tests are independent. They can be built in parallel; integration tests for all run after all are complete.

```
T2 ──┬── T3 [P]  (POST /api/diagrams)
     ├── T4 [P]  (GET /api/diagrams)
     ├── T5 [P]  (GET /api/diagrams/:id)
     └── T6 [P]  (PUT /api/diagrams/:id)
```

### Phase 3: Integration Tests (Sequential — not parallel-safe)

```
T3 + T4 + T5 + T6 → T7
```

### Phase 4: Editor Updates (Sequential — depends on routes working)

```
T7 → T8 → T9
```

### Phase 5: E2E (Sequential — full stack required)

```
T9 → T10
```

---

## Task Breakdown

### T1: Create `lib/diagrams.ts` (Prisma service layer)

**What**: Ownership-safe Prisma helpers for all diagram operations — `createDiagram`, `getDiagramById`, `listDiagrams`, `updateDiagram`
**Where**: `lib/diagrams.ts`
**Depends on**: `lib/db.ts` (M1 infra), `lib/excalidraw.ts` (M2a T2)
**Reuses**: `lib/db.ts`, `lib/excalidraw.ts`
**Requirement**: M2B-01, M2B-03, M2B-04, M2B-05

**Done when**:

- [ ] `createDiagram(userId, name?, data?)` → Prisma `create`, returns `DiagramDetail`; defaults `name = "Untitled"`, `data = EMPTY_DIAGRAM`
- [ ] `getDiagramById(id, userId)` → Prisma `findFirst({ where: { id, userId } })`; returns `DiagramDetail | null`; calls `deserializeCanvas(raw.data)` before returning
- [ ] `listDiagrams(userId)` → Prisma `findMany({ where: { userId }, select: { id, name, updatedAt } })`; returns `DiagramSummary[]` (no `data` field)
- [ ] `updateDiagram(id, userId, patch)` → Prisma `updateMany({ where: { id, userId } })`; returns `DiagramDetail | null` (`null` when 0 rows affected)
- [ ] `DiagramSummary` and `DiagramDetail` types exported
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: integration (T7)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T2: Update Prisma schema — add `updatedAt` index (if missing)

**What**: Verify `Diagram.updatedAt @updatedAt` is in schema (already present); add index on `(userId, updatedAt)` for list query performance
**Where**: `prisma/schema.prisma`, migration
**Depends on**: T1 (confirms which fields are accessed)
**Reuses**: Existing `Diagram` model
**Requirement**: M2B-04

**Done when**:

- [ ] `@@index([userId, updatedAt])` added to `Diagram` model
- [ ] `npx prisma migrate dev --name add-diagram-userid-updated-index` runs without error
- [ ] Migration file exists in `prisma/migrations/`
- [ ] `npx prisma generate` regenerates client
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: none (schema change — covered by integration tests in T7)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T3: Create `app/api/diagrams/route.ts` — POST handler [P]

**What**: `POST /api/diagrams` — create a new diagram for the authenticated user
**Where**: `app/api/diagrams/route.ts`
**Depends on**: T1 (`lib/diagrams.ts`), T2 (schema migrated)
**Reuses**: `lib/auth.ts`, `lib/diagrams.ts`, `zod`
**Requirement**: M2B-01, M2B-05

**Done when**:

- [ ] `POST /api/diagrams` with valid body → `201` with `DiagramDetail` (id, name, data, userId, createdAt, updatedAt)
- [ ] Zod validates body: `{ name?: string (min 1, max 255), data?: ExcalidrawState }` — both optional
- [ ] Missing / invalid body fields return `400` with error details
- [ ] Unauthenticated request returns `401`
- [ ] `userId` taken from session only — never from request body
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: integration (T7)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T4: Add GET handler to `app/api/diagrams/route.ts` — list [P]

**What**: `GET /api/diagrams` — return `DiagramSummary[]` for the authenticated user
**Where**: `app/api/diagrams/route.ts` (add `GET` export alongside existing `POST`)
**Depends on**: T3 (file exists), T1 (`lib/diagrams.ts`)
**Reuses**: `lib/auth.ts`, `lib/diagrams.ts`
**Requirement**: M2B-04, M2B-05

**Done when**:

- [ ] `GET /api/diagrams` returns `200` with array of `{ id, name, updatedAt }` — no `data` field in response
- [ ] Returns `[]` when user has no diagrams
- [ ] Response never includes diagrams from other users (enforced by `listDiagrams(userId)`)
- [ ] Unauthenticated request returns `401`
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: integration (T7)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T5: Create `app/api/diagrams/[id]/route.ts` — GET handler [P]

**What**: `GET /api/diagrams/:id` — return full `DiagramDetail` for the authenticated owner
**Where**: `app/api/diagrams/[id]/route.ts`
**Depends on**: T1 (`lib/diagrams.ts`), T2 (schema migrated)
**Reuses**: `lib/auth.ts`, `lib/diagrams.ts`
**Requirement**: M2B-03, M2B-05

**Done when**:

- [ ] `GET /api/diagrams/:id` for own diagram returns `200` with `{ id, name, data, updatedAt }`
- [ ] `data` field is typed as `ExcalidrawState` (not raw `Json`) — `deserializeCanvas` called in `lib/diagrams.ts`
- [ ] Returns `403` when diagram exists but belongs to another user
- [ ] Returns `403` (not `404`) when diagram doesn't exist — consistent ownership behavior
- [ ] Unauthenticated request returns `401`
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: integration (T7)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T6: Add PUT handler to `app/api/diagrams/[id]/route.ts` [P]

**What**: `PUT /api/diagrams/:id` — update `name` and/or `data` for the authenticated owner
**Where**: `app/api/diagrams/[id]/route.ts` (add `PUT` export alongside `GET`)
**Depends on**: T5 (file exists), T1 (`lib/diagrams.ts`)
**Reuses**: `lib/auth.ts`, `lib/diagrams.ts`, `zod`
**Requirement**: M2B-02, M2B-05

**Done when**:

- [ ] `PUT /api/diagrams/:id` with `{ data: ExcalidrawState }` updates `Diagram.data` and returns `200` with updated `DiagramDetail`
- [ ] `updatedAt` is updated on every successful PUT
- [ ] Zod validates body: requires at least one of `name` or `data`; returns `400` if both are absent
- [ ] Returns `403` when diagram doesn't belong to current user (or doesn't exist)
- [ ] Returns `400` when body is invalid
- [ ] Unauthenticated request returns `401`
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: integration (T7)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T7: Integration tests for Diagram API

**What**: Integration tests covering all four route handlers with a real Postgres test database
**Where**: `tests/integration/api/diagrams.integration.test.ts`
**Depends on**: T3, T4, T5, T6 (all routes complete)
**Reuses**: Test DB setup (from M1 infra pattern), `lib/diagrams.ts`
**Requirement**: M2B-01, M2B-02, M2B-03, M2B-04, M2B-05

**Done when**:

- [ ] Test setup: creates test user + session via DB; tears down diagrams after each test
- [ ] POST: valid body → 201 + record in DB; unauthenticated → 401; invalid body → 400
- [ ] GET list: user A gets only their diagrams; user B's diagrams not visible; empty → `[]`
- [ ] GET list: response items do NOT include `data` field
- [ ] GET :id: own diagram → 200 with full `data`; another user's → 403; missing → 403; unauth → 401
- [ ] PUT :id: updates `data` + `updatedAt`; wrong owner → 403; empty body → 400; unauth → 401
- [ ] Ownership cross-user test: user A cannot GET or PUT user B's diagram
- [ ] Gate check passes: `yarn lint && yarn test:unit && yarn test:integration`

**Tests**: integration
**Gate**: full — `yarn lint && yarn test:unit && yarn test:integration`

---

### T8: Update `app/(app)/diagrams/[id]/page.tsx` to fetch real diagram

**What**: Make the editor page async; replace `MOCK_DIAGRAM` with `getDiagramById(params.id, userId)` from the DB
**Where**: `app/(app)/diagrams/[id]/page.tsx`
**Depends on**: T7 (API + DB layer verified), `lib/auth.ts`, `lib/diagrams.ts`
**Reuses**: `lib/auth.ts`, `lib/diagrams.ts`, `ExcalidrawEditor`
**Requirement**: M2B-03

**Done when**:

- [ ] Page is `async` and calls `requireSession()`
- [ ] Calls `getDiagramById(params.id, session.user.id)`
- [ ] `null` result → `notFound()` (renders Next.js 404 page)
- [ ] Passes `diagram.data` as `initialData` and `diagram.id` as `diagramId` to `ExcalidrawEditor`
- [ ] Renders diagram `name` in a header/title area (simple `<h1>` or toolbar — no rename UX yet, that's M3)
- [ ] Navigating to `/diagrams/:id` for own diagram shows the saved canvas content
- [ ] Navigating to `/diagrams/:id` for another user's diagram shows 404
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: E2E (T10)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T9: Add Save button to `ExcalidrawCanvas.tsx`

**What**: Add `diagramId` prop; implement `handleSave` with fetch + save status state; render Save button and feedback
**Where**: `components/excalidraw/ExcalidrawCanvas.tsx`, `components/excalidraw/ExcalidrawEditor.tsx`
**Depends on**: T8 (page passes `diagramId` down)
**Reuses**: `lib/excalidraw.ts`, `PUT /api/diagrams/:id`
**Requirement**: M2B-02

**Done when**:

- [ ] `ExcalidrawEditor` accepts `diagramId: string` prop and passes it to `ExcalidrawCanvas`
- [ ] `ExcalidrawCanvas` accepts `diagramId: string` prop
- [ ] `localStateRef` (useRef) holds current serialized canvas state — updated on every `onChange`
- [ ] Save button visible in editor chrome; calls `handleSave` on click
- [ ] `handleSave`: disabled during in-flight request; calls `PUT /api/diagrams/:id` with `localStateRef.current`
- [ ] On success: displays "Saved" feedback (simple label, auto-hides after 2s)
- [ ] On failure: displays "Save failed" label; button re-enables for retry
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: E2E (T10)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T10: E2E tests for save and load flow

**What**: Playwright tests covering create → save → reload → verify; ownership guard on direct URL access
**Where**: `tests/e2e/diagrams.spec.ts`
**Depends on**: T8, T9 (editor page + save button complete)
**Reuses**: `playwright.config.ts`, auth setup from M1 E2E
**Requirement**: M2B-01, M2B-02, M2B-03, M2B-04, M2B-05

**Done when**:

- [ ] Test: create new diagram via `POST /api/diagrams` → navigate to `/diagrams/:id` → canvas loads with empty state
- [ ] Test: draw on canvas → click Save → "Saved" feedback appears → reload page → drawn elements visible (round-trip)
- [ ] Test: unauthenticated access to `/diagrams/:id` redirects to `/sign-in`
- [ ] Test: accessing another user's diagram URL shows 404 page (not a crash)
- [ ] Tests create isolated users per test (unique email pattern)
- [ ] Tests clean up created diagrams after each run
- [ ] Gate check passes: `yarn test:e2e`

**Tests**: E2E
**Gate**: full — `yarn lint && yarn test:unit && yarn test:integration && yarn test:e2e`

---

## Parallel Execution Map

```
Phase 1 (Sequential — data layer):
  [M2a complete]
  T1 ──→ T2

Phase 2 (Parallel — API routes, lint-only gate):
  T2 done, then:
    ├── T3 [P]
    ├── T4 [P]   } Independent files, parallel-safe
    ├── T5 [P]
    └── T6 [P]

Phase 3 (Sequential — integration tests, DB-bound):
  T3 + T4 + T5 + T6 done → T7

Phase 4 (Sequential — editor updates):
  T7 done → T8 → T9

Phase 5 (Sequential — E2E, full stack):
  T9 done → T10
```

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: lib/diagrams.ts | 1 service file, 4 functions | ✅ Granular |
| T2: schema index + migration | 1 schema change + 1 migration | ✅ Granular |
| T3: POST /api/diagrams | 1 route handler | ✅ Granular |
| T4: GET /api/diagrams | 1 route handler (same file as T3) | ✅ Granular |
| T5: GET /api/diagrams/:id | 1 route handler | ✅ Granular |
| T6: PUT /api/diagrams/:id | 1 route handler (same file as T5) | ✅ Granular |
| T7: integration tests | 1 test file | ✅ Granular |
| T8: editor page (real data) | 1 page update | ✅ Granular |
| T9: save button | 2 component updates | ✅ Granular |
| T10: E2E tests | 1 test file | ✅ Granular |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | `lib/` service | Integration | Integration (T7) | ✅ OK |
| T2 | Schema / migration | Integration | None — covered by T7 | ✅ OK |
| T3–T6 | API routes | Integration | Integration (T7) | ✅ OK |
| T7 | Test file | — | Integration | ✅ OK |
| T8 | Server Component | E2E | E2E (T10) | ✅ OK |
| T9 | Client Component | Unit + E2E | E2E (T10) | ✅ OK |
| T10 | Test file | — | E2E | ✅ OK |
