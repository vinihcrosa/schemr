# M4 — Editor Sidebar Tasks

**Design**: `.specs/features/m4-sidebar/design.md`
**Status**: Planned

**Prerequisites**: M3 complete — `lib/diagrams.ts` (listDiagrams, updateDiagram, deleteDiagram), all diagram API routes, `app/(app)/diagrams/[id]/page.tsx` all exist and work.

**M3 rollout note**: `components/diagrams/DiagramList.tsx` and `DiagramRow.tsx` are not deleted in this milestone. Leave them in place; remove in a cleanup pass once M4 is stable.

---

## Execution Plan

### Phase 1: Parallel — leaf components (no deps on each other)

```
T1 [P]  SidebarItem component
T2 [P]  Rework app/(app)/page.tsx (redirect + landing — no sidebar dep)
```

### Phase 2: Sequential after T1 — sidebar orchestrator

T3 depends on T1 (`SidebarItem` must exist). T4 depends on T3 (`DiagramSidebar` must exist before the page can import it).

```
T1 done → T3  DiagramSidebar
T3 done → T4  Update [id]/page.tsx layout
```

### Phase 3: Parallel — tests (after T2, T4)

```
T1 + T3 done → T5 [P]  Unit tests (SidebarItem + DiagramSidebar)
T2 + T4 done → T6 [P]  E2E tests (full sidebar flow + index redirect)
```

---

## Task Breakdown

### T1: Create `SidebarItem` component [P]

**What**: Single diagram row in the sidebar — idle display, rename mode, delete-pending mode, navigation
**Where**: `components/sidebar/SidebarItem.tsx`
**Depends on**: nothing (pure UI)
**Reuses**: `next/navigation` (`useRouter`)
**Requirement**: M4-03, M4-05, M4-06

**Done when**:

- [ ] Props: `{ id, name, isCurrent, onRename: (id, name) => void, onDelete: (id) => void }`
- [ ] **Idle mode**: name (truncated), edit icon + delete icon visible on hover
- [ ] **isCurrent**: highlighted background; clicking the row does nothing
- [ ] **Navigation**: clicking non-current row → `router.push(/diagrams/${id})`; icons stop propagation
- [ ] **Rename mode** (edit icon click): input pre-filled with name, auto-focused; Enter commits (non-blank + changed only); Escape / blur cancels and restores original name
- [ ] **Delete pending** (first delete icon click): icon turns red; tooltip "Click again to delete"; second click → `onDelete(id)`; click outside → cancel; auto-cancel after 3s via `setTimeout` (cleared on unmount and on any cancel)
- [ ] TypeScript reports no errors
- [ ] Gate: `npm run lint && npm run test:unit`

**Tests**: unit (T5)
**Gate**: quick

---

### T2: Rework `app/(app)/page.tsx` — redirect + landing [P]

**What**: Replace full listing page with redirect-to-most-recent or no-diagrams landing
**Where**: `app/(app)/page.tsx`
**Depends on**: nothing new (`listDiagrams` already exists)
**Reuses**: `listDiagrams`, `requireSession`, `next/navigation` (`redirect`)
**Requirement**: M4-07

**Done when**:

- [ ] Page calls `requireSession()` + `listDiagrams(userId)`
- [ ] If `diagrams.length > 0`: `redirect(\`/diagrams/${diagrams[0].id}\`)` — `listDiagrams` returns `updatedAt` desc, so index 0 is the most recent
- [ ] If `diagrams.length === 0`: renders minimal landing — "No diagrams yet." + `CreateFirstDiagramButton` (inline client component: POST `/api/diagrams` → `router.push` on success; disabled during in-flight)
- [ ] Old `DiagramList` import removed from page — `DiagramList.tsx` file itself is NOT deleted
- [ ] TypeScript reports no errors
- [ ] Gate: `npm run lint && npm run test:unit`

**Tests**: E2E (T6)
**Gate**: quick

---

### T3: Create `DiagramSidebar` component [after T1]

**What**: Collapsible, resizable sidebar — owns collapse state, width state, list state, all mutations
**Where**: `components/sidebar/DiagramSidebar.tsx`
**Depends on**: T1 (`SidebarItem` must exist)
**Reuses**: `SidebarItem`, `next/navigation` (`useRouter`), React hooks
**Requirement**: M4-01, M4-02, M4-04, M4-05, M4-06, M4-08

**Ordering invariant**: `items` state is always maintained in `updatedAt` descending order. Create prepends; rename is in-place; delete removes by id. Order is never re-sorted after initial load — mutations preserve it structurally.

**Done when**:

- [ ] Props: `{ diagrams: Array<{id, name, updatedAt: string}>, currentId: string }`
- [ ] **Collapse state**: `useState(false)` (SSR default: expanded); `useEffect` on mount reads `localStorage('schemr:sidebar:collapsed')` and applies; toggle updates both state and localStorage
- [ ] **Width state**: `useState(220)` (SSR default); `useEffect` on mount reads `localStorage('schemr:sidebar:width')` and applies; `widthRef` kept in sync via `useEffect` for stale-closure-safe localStorage write on drag end
- [ ] **Expanded layout**: header (title + "+" button) + scrollable `SidebarItem` list; drag handle on right edge
- [ ] **Collapsed layout**: narrow strip (~40px) with toggle button only — list not rendered
- [ ] **Drag resize** (M4-08): `mousedown` on right-edge handle → document `mousemove` + `mouseup`; width clamped to `≥ 180`; localStorage updated via `widthRef` on `mouseup`; `cursor-col-resize` on handle
- [ ] **Create** (`handleCreate`): POST `/api/diagrams`; prepend new item to `items`; `router.push(/diagrams/:id)`; button disabled during in-flight; error indicator on failure; revert prepend on failure
- [ ] **Rename** (`handleRename`): optimistic in-place name update → PUT → revert on failure
- [ ] **Delete** (`handleDelete`):
  - Compute `nextId` before removal: first item in `items` where `item.id !== id`; `null` if none
  - Remove item from `items` optimistically
  - Call `DELETE /api/diagrams/:id`
  - On success: if `id === currentId`, `router.push(/diagrams/${nextId})` or `router.push('/')` if `nextId === null`
  - On failure: re-insert item at original index; do not navigate
- [ ] `"use client"` directive
- [ ] TypeScript reports no errors
- [ ] Gate: `npm run lint && npm run test:unit`

**Tests**: unit (T5)
**Gate**: quick

---

### T4: Update `app/(app)/diagrams/[id]/page.tsx` [after T3]

**What**: Add sidebar to editor layout; fetch list + diagram in parallel
**Where**: `app/(app)/diagrams/[id]/page.tsx`
**Depends on**: T3 (`DiagramSidebar` must exist — not a placeholder import)
**Reuses**: `DiagramSidebar`, `getDiagramById`, `listDiagrams`, `requireSession`
**Requirement**: M4-01

**Done when**:

- [ ] Fetches via `Promise.all([getDiagramById(id, userId), listDiagrams(userId)])`
- [ ] `diagrams` serialized to ISO strings before passing as props
- [ ] Layout: `<div className="flex h-screen w-screen overflow-hidden">` with `<DiagramSidebar>` + `<main className="flex-1 overflow-hidden">`
- [ ] `ExcalidrawEditor` renders inside `<main>` (unchanged props)
- [ ] `notFound()` still fires when diagram doesn't belong to user
- [ ] Old full-screen `<main>` wrapper removed
- [ ] TypeScript reports no errors
- [ ] Gate: `npm run lint && npm run test:unit`

**Tests**: E2E (T6)
**Gate**: quick

---

### T5: Unit tests — `SidebarItem` + `DiagramSidebar` [P after T1, T3]

**What**: Unit tests for sidebar component state machines and interaction handlers
**Where**: `tests/unit/sidebar.unit.test.tsx` (new file)
**Depends on**: T1 (SidebarItem), T3 (DiagramSidebar)
**Reuses**: Vitest + React Testing Library, `vi.mock('next/navigation')`
**Requirement**: M4-01 through M4-06, M4-08

**Done when**:

**SidebarItem**:
- [ ] Idle: name renders; current item not clickable for navigation
- [ ] Non-current item click → `router.push(/diagrams/:id)` called
- [ ] Edit icon click → rename input renders pre-filled
- [ ] Enter with new name → `onRename` called; same name → not called; blank → not called
- [ ] Escape / blur in rename → `onRename` not called; original name visible
- [ ] First delete click → pending state (icon red or label change)
- [ ] Second delete click → `onDelete` called
- [ ] Click outside during delete-pending → `onDelete` not called

**DiagramSidebar**:
- [ ] Renders `SidebarItem` for each diagram in props; current item has `isCurrent=true`
- [ ] Toggle button click → collapsed state changes (list no longer rendered when collapsed)
- [ ] "+" button present and enabled when not creating
- [ ] Rename callback: optimistic update in list before fetch resolves (mock fetch)
- [ ] Rename failure: original name restored
- [ ] Delete callback: item removed from list optimistically
- [ ] Delete failure: item re-appears
- [ ] Delete of `currentId`: `router.push` called (verify mock)
- [ ] Create: new item prepended to list optimistically

- [ ] Gate: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

---

### T6: E2E tests — sidebar flow + index redirect [P after T2, T4]

**What**: Playwright tests covering the full sidebar UX and the reworked index route
**Where**: `tests/e2e/sidebar.spec.ts` (new); update `tests/e2e/auth.spec.ts` + `tests/e2e/listing.spec.ts`
**Depends on**: T2 (index redirect), T4 (editor with sidebar)
**Reuses**: `playwright.config.ts`, existing auth helpers
**Requirement**: M4-01 through M4-08

**Done when**:

**Index redirect**:
- [ ] Authenticated user with diagrams → `/` redirects to `/diagrams/:id`
- [ ] Authenticated user with no diagrams → `/` shows "No diagrams yet" + create button
- [ ] Clicking create button → POST → redirect to editor with sidebar

**Sidebar presence**:
- [ ] Opening `/diagrams/:id` → sidebar visible on left; canvas visible on right
- [ ] Current diagram visually distinct in sidebar

**Collapse / expand**:
- [ ] Toggle → sidebar collapses to icon only; reload → state preserved
- [ ] Toggle again → expands; reload → state preserved

**Resize**:
- [ ] Drag right edge → sidebar width changes; reload → width preserved

**Switch diagrams**:
- [ ] Create 2 diagrams → open first → click second in sidebar → URL changes to second; second highlighted

**Create from sidebar**:
- [ ] Click "+" → POST → navigate to new diagram → new item at top of sidebar

**Rename from sidebar**:
- [ ] Hover item → click edit icon → type new name → Enter → name updated in sidebar

**Delete from sidebar**:
- [ ] Hover → click delete once → pending state visible → click again → item removed
- [ ] Hover → click delete once → click elsewhere → item still present

**Update existing E2E tests**:
- [ ] `tests/e2e/auth.spec.ts`: assertions checking for "Your Diagrams" heading updated — `/` now redirects, so assert `toHaveURL(/\/diagrams\//)` instead
- [ ] `tests/e2e/listing.spec.ts`: tests that relied on the M3 index listing page updated or removed — the listing surface no longer exists at `/`

- [ ] Gate: `npm run lint && npm run test:unit && npm run test:integration && npm run test:e2e`

**Tests**: E2E
**Gate**: full (includes `test:integration` — sidebar mutations depend on existing API routes)

---

## Parallel Execution Map

```
Phase 1 (Parallel — no deps):
  T1 [P]  SidebarItem
  T2 [P]  page.tsx redirect rework

Phase 2 (Sequential — T1 must be done before T3; T3 before T4):
  T1 → T3  DiagramSidebar
  T3 → T4  [id]/page.tsx layout update

Phase 3 (Parallel — Phase 2 must be done):
  T1 + T3 done → T5 [P]  Unit tests
  T2 + T4 done → T6 [P]  E2E tests
```

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: SidebarItem | 1 component file, 3 mode states | ✅ Granular |
| T2: page.tsx redirect | 1 page, redirect + inline landing | ✅ Granular |
| T3: DiagramSidebar | 1 component, collapse + resize + mutations | ✅ Granular |
| T4: [id]/page.tsx | 1 page update, layout restructure | ✅ Granular |
| T5: Unit tests | 1 new test file | ✅ Granular |
| T6: E2E tests | 1 new + 2 updated test files | ✅ Granular |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Client component | Unit + E2E | Unit (T5) + E2E (T6) | ✅ OK |
| T2 | Server component | E2E | E2E (T6) | ✅ OK |
| T3 | Client component | Unit + E2E | Unit (T5) + E2E (T6) | ✅ OK |
| T4 | Server component | E2E | E2E (T6) | ✅ OK |
| T5 | Test file | — | Unit | ✅ OK |
| T6 | Test file | — | E2E + Integration gate | ✅ OK |
