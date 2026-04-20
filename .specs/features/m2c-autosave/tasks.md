# M2c — Autosave & UX Refinement Tasks

**Design**: `.specs/features/m2c-autosave/design.md`
**Status**: Planned

**Prerequisite**: M2b complete — `PUT /api/diagrams/:id` works, `ExcalidrawCanvas` accepts `diagramId`, `localStateRef` tracking canvas state.

---

## Execution Plan

### Phase 1: Core Hook (Sequential)

Hook is the foundation — all other pieces depend on it.

```
T1
```

### Phase 2: UI + Integration (Parallel after T1)

`SaveIndicator` and the canvas integration can be built in parallel — they share the `SaveStatus` type but don't block each other.

```
T1 ──┬── T2 [P]  (SaveIndicator component)
     └── T3 [P]  (integrate hook into ExcalidrawCanvas)
```

### Phase 3: Tab-Close + Cleanup (Sequential — depends on T3)

Tab-close handler lives inside the canvas, which must already have the hook integrated.

```
T2 + T3 → T4
```

### Phase 4: Tests (Sequential — full stack needed for E2E)

```
T1 → T5 [P]  (unit tests for hook — can start right after T1)
T4 → T6      (E2E — needs full stack)
```

---

## Task Breakdown

### T1: Create `hooks/useSaveStatus.ts`

**What**: Debounce + AbortController + save state machine (`idle | pending | saving | saved | error`). Exposes `schedulesSave`, `status`, and `retry`.
**Where**: `hooks/useSaveStatus.ts`
**Depends on**: `lib/excalidraw.ts` (M2a T2, for `ExcalidrawState` type)
**Reuses**: `lib/excalidraw.ts`
**Requirement**: M2C-01, M2C-02, M2C-05

**Done when**:

- [ ] `UseSaveStatusOptions` type: `{ diagramId: string; debounceMs?: number }`; default debounce `1500`
- [ ] `UseSaveStatusResult` type: `{ status: SaveStatus; schedulesSave: (state: ExcalidrawState) => void; retry: () => void }`
- [ ] `SaveStatus` type exported: `"idle" | "pending" | "saving" | "saved" | "error"`
- [ ] `schedulesSave(state)`: stores state in `pendingStateRef`, sets status to `"pending"`, clears existing timer, sets new `setTimeout`
- [ ] Timer callback: calls internal `save(pendingStateRef.current)`
- [ ] `save(state)`: aborts previous `AbortController`; creates new one; sets status to `"saving"`; calls `PUT /api/diagrams/:id` with `signal`; on success → `"saved"` then `"idle"` after 2s; on error (non-abort) → `"error"`; on `AbortError` → no state change
- [ ] `retry()`: calls `save(pendingStateRef.current)` immediately (no debounce)
- [ ] `useEffect` cleanup: `clearTimeout(timerRef.current)` + `abortRef.current?.abort()` on unmount
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: unit (T5)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T2: Create `components/excalidraw/SaveIndicator.tsx` [P]

**What**: Small UI component that renders save status feedback — nothing for `idle`/`pending`, "Saving…" for `saving`, "Saved ✓" for `saved`, persistent "Save failed · Retry" for `error`
**Where**: `components/excalidraw/SaveIndicator.tsx`
**Depends on**: T1 (`SaveStatus` type available)
**Reuses**: `hooks/useSaveStatus.ts` (type import only — no hook instantiation here)
**Requirement**: M2C-03

**Done when**:

- [ ] Props: `{ status: SaveStatus; onRetry: () => void }`
- [ ] `idle` and `pending`: renders `null` (no DOM output)
- [ ] `saving`: renders "Saving…" (muted text — e.g., Tailwind `text-sm text-gray-400`)
- [ ] `saved`: renders "Saved ✓" (same styling; disappears automatically because hook transitions to `idle` after 2s)
- [ ] `error`: renders "Save failed · " + clickable "Retry" button; button calls `onRetry`; persists until retry succeeds
- [ ] Component is positioned non-intrusively (top-right corner overlay, `absolute` positioning within editor chrome)
- [ ] Unit test: renders correct text for each status; retry button calls `onRetry`
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: unit
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T3: Integrate `useSaveStatus` into `ExcalidrawCanvas.tsx` [P]

**What**: Replace M2b's manual `handleSave` + save button with `useSaveStatus` hook; call `schedulesSave` from `onChange`; render `<SaveIndicator>`
**Where**: `components/excalidraw/ExcalidrawCanvas.tsx`
**Depends on**: T1 (hook), T2 (`SaveIndicator` — can be parallel but needs it before this task is "done")
**Reuses**: `hooks/useSaveStatus.ts`, `components/excalidraw/SaveIndicator.tsx`
**Requirement**: M2C-01, M2C-02, M2C-03

**Done when**:

- [ ] M2b's `saveStatus` state and standalone `handleSave` function removed
- [ ] M2b's explicit Save button removed
- [ ] `const { status, schedulesSave, retry } = useSaveStatus({ diagramId })` instantiated inside component
- [ ] `handleChange` calls `schedulesSave(state)` after updating `localStateRef`
- [ ] `<SaveIndicator status={status} onRetry={retry} />` rendered in editor chrome
- [ ] `localStateRef` retained (still needed for tab-close handler in T4 as a fallback — `pendingStateRef` lives inside the hook)
- [ ] No duplicate save logic remains in the component
- [ ] TypeScript reports no errors
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: E2E (T6)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T4: Add `beforeunload` / `sendBeacon` flush handler

**What**: On tab close or navigation away, flush any pending unsaved state via `navigator.sendBeacon`
**Where**: `components/excalidraw/ExcalidrawCanvas.tsx` (add `useEffect` with `beforeunload` listener)
**Depends on**: T3 (hook integrated — needs access to `status` and `diagramId`)
**Reuses**: `hooks/useSaveStatus.ts` (`status` value), `lib/excalidraw.ts` (`ExcalidrawState`)
**Requirement**: M2C-04

**Done when**:

- [ ] `useEffect` adds `beforeunload` event listener; cleanup removes it
- [ ] Handler fires only when `status === "pending"` (debounce timer active but save not yet sent)
- [ ] Handler calls `navigator.sendBeacon(url, new Blob([JSON.stringify({ data: localStateRef.current })], { type: "application/json" }))`
- [ ] No response handling (fire-and-forget by design)
- [ ] Handler does NOT fire when status is `idle`, `saving`, `saved`, or `error`
- [ ] TypeScript reports no errors (note: `sendBeacon` is not available in jsdom — guard with `typeof navigator !== "undefined"`)
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: E2E (T6 — limited; tab-close behavior is browser-dependent)
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T5: Unit tests for `hooks/useSaveStatus.ts` [P]

**What**: Unit tests for the hook's debounce, abort, and state machine behavior using fake timers and mocked `fetch`
**Where**: `tests/unit/hooks/useSaveStatus.unit.test.ts`
**Depends on**: T1 (hook complete)
**Reuses**: `hooks/useSaveStatus.ts`
**Requirement**: M2C-01, M2C-02, M2C-05

**Done when**:

- [ ] Test setup: `vi.useFakeTimers()`, `vi.stubGlobal("fetch", mockFetch)` per suite
- [ ] Test: calling `schedulesSave` sets status to `"pending"` immediately
- [ ] Test: calling `schedulesSave` twice before timer fires → only one fetch call (debounce works)
- [ ] Test: after `debounceMs` passes, status transitions to `"saving"`
- [ ] Test: fetch resolves ok → status transitions to `"saved"`, then `"idle"` after 2s
- [ ] Test: fetch rejects → status transitions to `"error"`
- [ ] Test: second `schedulesSave` during active `"saving"` → previous request aborted (AbortError not treated as failure)
- [ ] Test: `retry()` triggers immediate `save()` without debounce
- [ ] Test: unmount during `"pending"` → no fetch called after unmount (cleanup works)
- [ ] Gate check passes: `yarn lint && yarn test:unit`

**Tests**: unit
**Gate**: quick — `yarn lint && yarn test:unit`

---

### T6: E2E tests for autosave behavior

**What**: Playwright tests confirming autosave fires after drawing, status indicator cycles through states, and retry works after simulated failure
**Where**: `tests/e2e/autosave.spec.ts`
**Depends on**: T3, T4 (full canvas integration), T5 (unit tests passing)
**Reuses**: `playwright.config.ts`, auth + diagram setup from M2b E2E pattern
**Requirement**: M2C-01, M2C-02, M2C-03, M2C-05

**Done when**:

- [ ] Test: draw on canvas → wait 2s → "Saved ✓" indicator appears → reload page → elements still present (round-trip via autosave, no manual save)
- [ ] Test: rapidly draw for 3s → only one `PUT /api/diagrams/:id` request in network log after drawing stops (debounce consolidation)
- [ ] Test: simulate network failure (Playwright route interception) → draw → wait 2s → "Save failed · Retry" indicator appears → restore network → click Retry → "Saved ✓" appears
- [ ] Test: draw → navigate away within 1s → return to diagram → elements visible (best-effort flush; test may be flaky on some browsers — mark as soft assertion)
- [ ] Tests use isolated diagram per test
- [ ] Gate check passes: `yarn test:e2e`

**Tests**: E2E
**Gate**: full — `yarn lint && yarn test:unit && yarn test:integration && yarn test:e2e`

---

## Parallel Execution Map

```
Phase 1 (Sequential — hook foundation):
  [M2b complete]
  T1

Phase 2 (Parallel — UI + canvas integration):
  T1 done, then:
    ├── T2 [P]  (SaveIndicator — unit tests only)
    └── T3 [P]  (canvas integration — lint only gate)

Phase 3 (Sequential — tab close handler):
  T2 + T3 done → T4

Phase 4 (Parallel where possible):
  T1 done → T5 [P]  (unit tests — parallel-safe)
  T4 done → T6      (E2E — sequential, full stack)
```

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: useSaveStatus.ts | 1 custom hook | ✅ Granular |
| T2: SaveIndicator.tsx | 1 small component | ✅ Granular |
| T3: ExcalidrawCanvas integration | Updates to 1 component | ✅ Granular |
| T4: beforeunload / sendBeacon | 1 useEffect addition | ✅ Granular |
| T5: useSaveStatus unit tests | 1 unit test file | ✅ Granular |
| T6: autosave E2E tests | 1 E2E test file | ✅ Granular |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Custom hook (`hooks/`) | Unit | Unit (T5) | ✅ OK |
| T2 | React component | Unit | Unit (inline in T2) | ✅ OK |
| T3 | Client Component update | Unit + E2E | E2E (T6) | ✅ OK |
| T4 | Side effect in component | E2E | E2E (T6, soft) | ✅ OK |
| T5 | Test file | — | Unit | ✅ OK |
| T6 | Test file | — | E2E | ✅ OK |
