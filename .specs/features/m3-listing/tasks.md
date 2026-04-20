# M3 — Listing & Navigation Tasks

**Design**: `.specs/features/m3-listing/design.md`
**Status**: Planned

**Prerequisites**: M2b + M2c complete — `lib/diagrams.ts` (with `listDiagrams`, `updateDiagram`), `app/api/diagrams/[id]/route.ts` (GET + PUT), and autosave all exist.

---

## Execution Plan

### Phase 1: Parallel — data layer + UI row component

Both tracks are independent. Data layer adds delete support; `DiagramRow` is pure UI with no data deps.

```
T1 [P]  (deleteDiagram service function)
T3 [P]  (DiagramRow component)
```

### Phase 2: Parallel — DELETE route + list orchestrator

Each depends on its Phase 1 predecessor only.

```
T1 done → T2 [P]  (DELETE /api/diagrams/:id)
T3 done → T4 [P]  (DiagramList component)
```

### Phase 3: Parallel — page + integration tests + unit tests

All three depend on Phase 2 outputs; none depend on each other.

```
T4 done → T5 [P]  (page.tsx server component)
T2 done → T6 [P]  (integration tests — DELETE route)
T3 + T4 done → T7 [P]  (unit tests — DiagramRow + DiagramList)
```

### Phase 4: Sequential — E2E (full stack required)

```
T5 + T6 + T7 → T8
```

---

## Task Breakdown

### T1: Add `deleteDiagram` to `lib/diagrams.ts` [P]

**What**: New service function for ownership-safe diagram deletion
**Where**: `lib/diagrams.ts`
**Depends on**: nothing new — extends existing file
**Reuses**: `lib/db.ts`, existing ownership pattern
**Requirement**: M3-05

**Done when**:

- [ ] `deleteDiagram(id: string, userId: string): Promise<boolean>` exported from `lib/diagrams.ts`
- [ ] Uses `db.diagram.deleteMany({ where: { id, userId } })` — no pre-flight `findFirst`
- [ ] Returns `true` when `count > 0`, `false` when `count === 0` (covers not-found and wrong-owner)
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: integration (T6)
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T2: Add DELETE handler to `app/api/diagrams/[id]/route.ts` [P after T1]

**What**: `DELETE /api/diagrams/:id` — delete the authenticated user's diagram
**Where**: `app/api/diagrams/[id]/route.ts` (add `DELETE` export alongside existing `GET` and `PUT`)
**Depends on**: T1 (`deleteDiagram` exists)
**Reuses**: `lib/auth.ts`, `lib/diagrams.ts`
**Requirement**: M3-05

**Done when**:

- [ ] `DELETE /api/diagrams/:id` by owner returns `200` with `{}`
- [ ] When `deleteDiagram` returns `false` → `403 Forbidden` (opaque: covers not-found + wrong-owner)
- [ ] Unauthenticated request returns `401`
- [ ] No request body parsing — `id` comes from URL param only
- [ ] `userId` from session only — never from request
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: integration (T6)
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T3: Create `DiagramRow` component [P]

**What**: Single diagram row — idle display, rename mode, delete confirm mode, row navigation
**Where**: `components/diagrams/DiagramRow.tsx`
**Depends on**: nothing (pure UI — no data layer deps)
**Reuses**: nothing new
**Requirement**: M3-02, M3-04, M3-05

**Done when**:

- [ ] Props: `{ id, name, updatedAt: string, onRename: (id, name) => void, onDelete: (id) => void }`
- [ ] **Idle mode**: renders name + formatted timestamp + rename affordance (icon or button) + delete icon
- [ ] **Navigation**: clicking the row area (not rename/delete icons) calls `router.push(\`/diagrams/${id}\`)`; rename/delete icons stop propagation
- [ ] **Rename mode**: triggered by clicking name or rename icon; renders `<input>` pre-filled with current name
  - Enter → if blank/whitespace: cancel; if same as current: cancel; otherwise: call `onRename`
  - Escape → cancel, restore original name, set mode `"idle"`
  - Blur → cancel (do NOT submit — avoids collision when user clicks delete)
- [ ] **Delete confirm mode**: triggered by clicking delete icon; renders inline "Delete '[name]'? This cannot be undone." + Cancel + Delete buttons within the row
  - Cancel → set mode `"idle"`
  - Delete → call `onDelete(id)`, set mode `"idle"`
- [ ] `formatUpdatedAt(iso: string): string` — "Just now" (<1h), "Xh ago" (<24h), "Apr 15, 2026" (older)
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit (T7)
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T4: Create `DiagramList` component [P after T3]

**What**: Client component that owns list state, handles optimistic mutations, renders rows + header + empty state
**Where**: `components/diagrams/DiagramList.tsx`
**Depends on**: T3 (`DiagramRow` exists)
**Reuses**: `DiagramRow`, `next/navigation` (`useRouter`)
**Requirement**: M3-01, M3-03, M3-04, M3-05

**Done when**:

- [ ] Props: `{ diagrams: Array<{ id: string, name: string, updatedAt: string }> }`
- [ ] Local state: `const [items, setItems] = useState(props.diagrams)`
- [ ] **Header**: title + `NewDiagramButton` (inline — not a separate file)
  - `NewDiagramButton`: disabled during in-flight POST; calls `POST /api/diagrams`; on success `router.push(/diagrams/:id)`; on failure shows inline error + re-enables
- [ ] **Empty state** (inline — not a separate file): renders when `items.length === 0`; includes primary "New Diagram" CTA
- [ ] **List**: renders `<DiagramRow>` for each item in `items`
- [ ] **Rename** (`onRename` callback):
  - Optimistic: update name in `items` immediately
  - Call `PUT /api/diagrams/:id { name }`
  - On failure: revert name in `items`; set row-level error visible (pass error state down to row or re-render row with error prop)
- [ ] **Delete** (`onDelete` callback):
  - Optimistic: remove item from `items` immediately (store removed item + index for revert)
  - Call `DELETE /api/diagrams/:id`
  - On failure: re-insert item at original index in `items`
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit (T7)
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T5: Update `app/(app)/page.tsx` — server component [P after T4]

**What**: Replace placeholder with async server component that fetches diagrams and renders `DiagramList`
**Where**: `app/(app)/page.tsx`
**Depends on**: T4 (`DiagramList` exists), `lib/diagrams.ts` (`listDiagrams` already exists)
**Reuses**: `lib/auth.ts`, `lib/diagrams.ts`, `DiagramList`
**Requirement**: M3-01

**Done when**:

- [ ] Page is `async` and calls `requireSession()`
- [ ] Calls `listDiagrams(session.user.id)` directly (no API hop)
- [ ] Passes result as `diagrams` prop to `DiagramList`
- [ ] Unauthenticated requests hit middleware redirect before page renders (no change needed — verify only)
- [ ] Navigating to `/` while authenticated renders the diagram list (or empty state)
- [ ] Old placeholder text "Diagram Index — coming soon" is removed
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: E2E (T8)
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T6: Integration tests — DELETE endpoint [P after T2]

**What**: Integration tests for `DELETE /api/diagrams/:id` with real Postgres test DB
**Where**: `tests/integration/api/diagrams.integration.test.ts` (add to existing file)
**Depends on**: T2 (DELETE handler complete)
**Reuses**: existing test DB setup, user factories from M2b integration tests
**Requirement**: M3-05

**Done when**:

- [ ] DELETE own diagram → `200 {}` + record no longer in DB
- [ ] DELETE another user's diagram → `403` + record still in DB
- [ ] DELETE non-existent ID → `403` (opaque — same as wrong owner)
- [ ] DELETE unauthenticated → `401`
- [ ] After DELETE, `GET /api/diagrams` for owner returns the diagram removed from the list
- [ ] Gate check passes: `npm run lint && npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full — `npm run lint && npm run test:unit && npm run test:integration`

---

### T7: Unit tests — `DiagramRow` + `DiagramList` [P after T3, T4]

**What**: Unit tests for component state machines and interaction handlers
**Where**: `tests/unit/diagram-index.unit.test.tsx` (replace placeholder test + expand)
**Depends on**: T3 (`DiagramRow`), T4 (`DiagramList`)
**Reuses**: Vitest + React Testing Library (existing setup)
**Requirement**: M3-01, M3-02, M3-03, M3-04, M3-05

**Done when**:

**DiagramRow**:
- [ ] Idle mode: name, formatted timestamp, rename icon, delete icon all render
- [ ] Clicking row area fires `router.push(/diagrams/:id)` (mock `useRouter`)
- [ ] Clicking rename icon → input renders pre-filled with name
- [ ] Enter with valid name → `onRename` called with trimmed value
- [ ] Enter with blank name → `onRename` NOT called; mode returns to idle
- [ ] Enter with same name as original → `onRename` NOT called
- [ ] Escape in rename mode → `onRename` NOT called; mode returns to idle
- [ ] Blur in rename mode → `onRename` NOT called (cancel, not submit)
- [ ] Clicking delete icon → inline confirm UI renders with diagram name
- [ ] Cancel in confirm mode → `onDelete` NOT called; mode returns to idle
- [ ] Delete in confirm mode → `onDelete` called with id

**DiagramList**:
- [ ] Renders `DiagramRow` for each diagram in props
- [ ] Empty state renders when `diagrams = []`
- [ ] "New Diagram" button present in header
- [ ] `onRename` callback: optimistic name update visible before fetch resolves (mock `fetch`)
- [ ] `onDelete` callback: item removed from list before fetch resolves (mock `fetch`)
- [ ] On rename fetch failure: original name restored in list
- [ ] On delete fetch failure: item re-appears in list

- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T8: E2E tests — full listing flow

**What**: Playwright tests covering the complete M3 user journeys in a real browser
**Where**: `tests/e2e/listing.spec.ts`
**Depends on**: T5, T6, T7 (all complete)
**Reuses**: `playwright.config.ts`, auth setup from M1/M2 E2E
**Requirement**: M3-01, M3-02, M3-03, M3-04, M3-05

**Done when**:

- [ ] Test: authenticated user with no diagrams → `/` shows empty state with "New Diagram" CTA
- [ ] Test: authenticated user with diagrams → `/` shows list with names + timestamps; ordered by most recent first
- [ ] Test: click "New Diagram" → redirected to `/diagrams/:id` → blank canvas renders
- [ ] Test: click diagram row → redirected to `/diagrams/:id` → saved canvas renders
- [ ] Test: rename diagram → input appears → type new name → Enter → name updated in list
- [ ] Test: rename diagram → Escape → original name restored
- [ ] Test: delete diagram → confirm prompt appears → click Delete → diagram removed from list
- [ ] Test: delete diagram → click Cancel → diagram remains in list
- [ ] Test: unauthenticated access to `/` → redirect to `/sign-in`
- [ ] Tests create isolated users + diagrams per test; clean up after each run
- [ ] Gate check passes: `npm run lint && npm run test:unit && npm run test:integration && npm run test:e2e`

**Tests**: E2E
**Gate**: full — `npm run lint && npm run test:unit && npm run test:integration && npm run test:e2e`

---

## Parallel Execution Map

```
Phase 1 (Parallel — independent tracks):
  T1 [P]  (deleteDiagram service)
  T3 [P]  (DiagramRow component)

Phase 2 (Parallel — each needs its Phase 1 dep):
  T1 done → T2 [P]  (DELETE route)
  T3 done → T4 [P]  (DiagramList component)

Phase 3 (Parallel — all need Phase 2):
  T4 done → T5 [P]  (page.tsx)
  T2 done → T6 [P]  (integration tests)
  T3 + T4 done → T7 [P]  (unit tests)

Phase 4 (Sequential — full stack required):
  T5 + T6 + T7 done → T8
```

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: deleteDiagram | 1 function added to existing file | ✅ Granular |
| T2: DELETE route | 1 route handler added to existing file | ✅ Granular |
| T3: DiagramRow | 1 component file, 3 mode states | ✅ Granular |
| T4: DiagramList | 1 component file, list state + 2 mutation flows | ✅ Granular |
| T5: page.tsx | 1 page file update (~10 lines) | ✅ Granular |
| T6: integration tests | Additions to existing test file | ✅ Granular |
| T7: unit tests | 1 test file (replaces placeholder) | ✅ Granular |
| T8: E2E tests | 1 new test file | ✅ Granular |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | `lib/` service | Integration | Integration (T6) | ✅ OK |
| T2 | API route | Integration | Integration (T6) | ✅ OK |
| T3 | Client component | Unit + E2E | Unit (T7) + E2E (T8) | ✅ OK |
| T4 | Client component | Unit + E2E | Unit (T7) + E2E (T8) | ✅ OK |
| T5 | Server component | E2E | E2E (T8) | ✅ OK |
| T6 | Test file | — | Integration | ✅ OK |
| T7 | Test file | — | Unit | ✅ OK |
| T8 | Test file | — | E2E | ✅ OK |
