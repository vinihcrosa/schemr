# M2a — Editor Integration Tasks

**Design**: `.specs/features/m2a-editor-integration/design.md`
**Status**: Planned

**Prerequisite**: M1 complete (auth, middleware, `lib/db.ts`, `lib/auth.ts` available).

---

## Execution Plan

### Phase 1: Package + Utilities (Sequential)

Install first — types aren't available until the package is installed.

```
T1 → T2
```

### Phase 2: Components (Sequential)

Canvas depends on utilities. Wrapper depends on canvas (dynamic import target).

```
T2 → T3 → T4
```

### Phase 3: Editor Page (Sequential)

Page depends on the wrapper component existing.

```
T4 → T5
```

### Phase 4: Tests (Parallel where possible)

Unit tests for `lib/excalidraw.ts` can run as soon as T2 is done.
E2E needs everything done.

```
T2 → T6 [P]    (unit — serializarion utilities)
T5 → T7        (E2E — canvas render)
```

---

## Task Breakdown

### T1: Install `@excalidraw/excalidraw`

**What**: Add the Excalidraw package to the project
**Where**: `package.json`, `yarn.lock`
**Depends on**: nothing
**Reuses**: nothing
**Requirement**: M2A-01

**Done when**:

- [ ] `yarn add @excalidraw/excalidraw` completes without error
- [ ] TypeScript can resolve `@excalidraw/excalidraw` types without `@types/` workaround
- [ ] `next.config.ts` transpiles the package if needed (check if `transpilePackages` is required for Next.js 16 + Excalidraw)
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: none
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T2: Create `lib/excalidraw.ts` (types + serialize/deserialize)

**What**: `ExcalidrawState` type, `serializeCanvas`, `deserializeCanvas`, `EMPTY_DIAGRAM`, `MOCK_DIAGRAM`
**Where**: `lib/excalidraw.ts`
**Depends on**: T1 (package installed for types)
**Reuses**: nothing
**Requirement**: M2A-03, M2A-04

**Done when**:

- [ ] `ExcalidrawState` type exported: `{ elements: readonly ExcalidrawElement[], appState: Partial<AppState>, files: BinaryFiles }`
- [ ] `serializeCanvas(elements, appState, files): ExcalidrawState` — wraps the three Excalidraw callback args into the shared type
- [ ] `deserializeCanvas(data: unknown): ExcalidrawState` — validates shape; returns `EMPTY_DIAGRAM` on null/invalid input; never throws
- [ ] `EMPTY_DIAGRAM` exported: `{ elements: [], appState: {}, files: {} }`
- [ ] `MOCK_DIAGRAM` exported: at least one rectangle element with valid Excalidraw shape; used as M2a initialization fixture
- [ ] TypeScript reports no errors on all exports
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: unit (T6)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T3: Create `components/excalidraw/ExcalidrawCanvas.tsx`

**What**: `"use client"` component that mounts `<Excalidraw />`, receives `initialData`, and calls `onChange` with serialized state on every change
**Where**: `components/excalidraw/ExcalidrawCanvas.tsx`
**Depends on**: T2 (`ExcalidrawState`, `serializeCanvas` available)
**Reuses**: `lib/excalidraw.ts`
**Requirement**: M2A-01, M2A-02, M2A-03, M2A-04

**Done when**:

- [ ] File starts with `"use client"`
- [ ] Props: `{ initialData: ExcalidrawState; onChange?: (state: ExcalidrawState) => void }`
- [ ] Renders `<Excalidraw initialData={initialData} onChange={handler} />` filling container (`w-full h-full`)
- [ ] `onChange` handler calls `serializeCanvas(elements, appState, files)` and forwards the result to `props.onChange` if provided
- [ ] Canvas state stored in `useRef` — not `useState` — to avoid re-renders on every pointer event
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: none at this layer (behavior tested via E2E in T7)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T4: Create `components/excalidraw/ExcalidrawEditor.tsx`

**What**: `"use client"` wrapper that dynamically imports `ExcalidrawCanvas` with `ssr: false`; the only component that page.tsx imports
**Where**: `components/excalidraw/ExcalidrawEditor.tsx`
**Depends on**: T3 (`ExcalidrawCanvas` exists as the dynamic import target)
**Reuses**: `ExcalidrawCanvas`, `lib/excalidraw.ts`
**Requirement**: M2A-01

**Done when**:

- [ ] File starts with `"use client"`
- [ ] `ExcalidrawCanvas` is imported via `next/dynamic` with `{ ssr: false }`
- [ ] Loading fallback rendered while the dynamic chunk loads (full-screen div, e.g. `<div className="h-screen w-screen bg-white" />`)
- [ ] Props passthrough: `{ initialData: ExcalidrawState; onChange?: (state: ExcalidrawState) => void }` forwarded unchanged to canvas
- [ ] No direct import of `@excalidraw/excalidraw` in this file (only `ExcalidrawCanvas` is imported — dynamically)
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: none (SSR boundary — not unit-testable; validated via E2E in T7)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T5: Create `app/(app)/diagrams/[id]/page.tsx` (mock data version)

**What**: Server Component editor page for the `/diagrams/:id` route; initializes Excalidraw with `MOCK_DIAGRAM` (no DB call in M2a)
**Where**: `app/(app)/diagrams/[id]/page.tsx`
**Depends on**: T4 (`ExcalidrawEditor` available), T2 (`MOCK_DIAGRAM` available)
**Reuses**: `ExcalidrawEditor`, `lib/excalidraw.ts`, `lib/auth.ts` (for session check)
**Requirement**: M2A-01, M2A-02, M2A-03

**Done when**:

- [ ] Route `/diagrams/:id` renders without SSR errors (no console errors related to Excalidraw)
- [ ] Page calls `requireSession()` — unauthenticated access redirects to sign-in via middleware (existing behavior)
- [ ] Renders `<ExcalidrawEditor initialData={MOCK_DIAGRAM} />` inside a `h-screen w-screen` container
- [ ] No database call in M2a version — `params.id` is not used yet (will be used in M2b)
- [ ] Navigating to `/diagrams/any-id` while authenticated renders the canvas with mock shapes visible
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: E2E (T7)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T6: Unit tests for `lib/excalidraw.ts` [P]

**What**: Unit tests covering serialize/deserialize round-trip, `EMPTY_DIAGRAM` fallback, and `MOCK_DIAGRAM` validity
**Where**: `tests/unit/lib/excalidraw.unit.test.ts`
**Depends on**: T2 (`lib/excalidraw.ts` complete)
**Reuses**: `lib/excalidraw.ts`
**Requirement**: M2A-04

**Done when**:

- [ ] Test: `serializeCanvas(elements, appState, files)` returns object with all three fields
- [ ] Test: `deserializeCanvas(MOCK_DIAGRAM)` returns an object with `elements.length > 0`
- [ ] Test: `deserializeCanvas(null)` returns `EMPTY_DIAGRAM` (no throw)
- [ ] Test: `deserializeCanvas({})` returns `EMPTY_DIAGRAM` (no throw)
- [ ] Test: `deserializeCanvas(EMPTY_DIAGRAM)` returns object with `elements: []`
- [ ] Test: round-trip — `deserializeCanvas(serializeCanvas(elements, appState, files))` preserves `elements` identity
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: unit
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T7: E2E tests for canvas render and interaction

**What**: Playwright tests confirming the canvas renders in the browser, mock data is visible, and drawing works
**Where**: `tests/e2e/editor.spec.ts`
**Depends on**: T5 (editor page complete), T6 (unit tests pass)
**Reuses**: `playwright.config.ts`
**Requirement**: M2A-01, M2A-02, M2A-03

**Done when**:

- [ ] Test: authenticated user navigates to `/diagrams/test-id` → page renders, no console errors about SSR
- [ ] Test: canvas element is visible in the DOM (`[data-testid="excalidraw-canvas"]` or equivalent selector)
- [ ] Test: mock shapes are rendered on the canvas (at least one element visible — check via DOM or screenshot)
- [ ] Test: user can select rectangle tool, drag on canvas, and a new element appears (action-based test, not pixel-perfect)
- [ ] Test: unauthenticated access to `/diagrams/test-id` redirects to `/sign-in`
- [ ] Tests use a test user created fresh per run (consistent with M1 E2E pattern)
- [ ] Gate check passes: `yarn test:e2e`

**Tests**: E2E
**Gate**: full — `yarn lint && yarn test:unit && yarn test:integration && yarn test:e2e`

---

## Parallel Execution Map

```
Phase 1 (Sequential — install + utilities):
  T1 ──→ T2

Phase 2 (Sequential — components):
  T2 ──→ T3 ──→ T4

Phase 3 (Sequential — page):
  T4 ──→ T5

Phase 4 (Parallel where possible):
  T2 done → T6 [P]  (unit tests, parallel-safe)
  T5 done → T7      (E2E, sequential)
```

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: Install package | 1 yarn command + possible next.config update | ✅ Granular |
| T2: lib/excalidraw.ts | 1 utility file, 4 exports | ✅ Granular |
| T3: ExcalidrawCanvas.tsx | 1 client component | ✅ Granular |
| T4: ExcalidrawEditor.tsx | 1 dynamic wrapper | ✅ Granular |
| T5: diagrams/[id]/page.tsx | 1 server component (mock data) | ✅ Granular |
| T6: excalidraw.unit.test.ts | 1 unit test file | ✅ Granular |
| T7: editor.spec.ts | 1 E2E test file | ✅ Granular |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T2 | `lib/` utility | Unit | Unit (T6) | ✅ OK |
| T3 | React component | Unit + E2E | E2E via T7 | ✅ OK (canvas not unit-testable in jsdom) |
| T4 | Dynamic wrapper | Unit + E2E | E2E via T7 | ✅ OK (SSR boundary — E2E only) |
| T5 | Server Component + page | E2E | E2E (T7) | ✅ OK |
| T6 | Test file | — | Unit | ✅ OK |
| T7 | Test file | — | E2E | ✅ OK |
