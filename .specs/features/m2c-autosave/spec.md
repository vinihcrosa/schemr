# M2c — Autosave & UX Refinement Specification

## Problem Statement

Manual save (M2b) is a functional but friction-heavy experience for a diagramming tool. Users shouldn't need to remember to save — diagrams should persist automatically as they draw. This milestone replaces (or supplements) the manual save button with debounced autosave, while handling the edge cases that make autosave hard: rapid edits, concurrent in-flight requests, and the tab-close race condition.

## Goals

- [ ] Canvas changes trigger an automatic save 1–2 seconds after the user stops drawing
- [ ] Concurrent save requests are prevented — only one request is in-flight at a time
- [ ] Users receive ambient feedback about save status (saving / saved / error) without interruption
- [ ] Edge cases (rapid edits, tab close, network failure) are handled gracefully without data loss or UI freezes

## Out of Scope

| Feature | Reason |
|---|---|
| Version history / conflict resolution | Post-MVP |
| Collaborative editing (multi-user conflicts) | Post-MVP |
| Offline support / local cache | Post-MVP |
| Save indicator animations beyond simple text label | Post-MVP |
| Undo history sync with server | Post-MVP |

---

## User Stories

### P1: Autosave after drawing ⭐ MVP

**User Story**: As a user drawing on the canvas, I want my changes to be saved automatically so that I never lose work by forgetting to click Save.

**Why P1**: Manual save is a footgun in a diagramming tool. Autosave is the expected baseline UX.

**Acceptance Criteria**:

1. WHEN the user makes any change to the canvas (add, move, delete, resize element) THEN system SHALL schedule a save 1–2 seconds after the last change
2. WHEN the debounce timer fires THEN system SHALL call `PUT /api/diagrams/:id` with the current canvas state
3. WHEN the autosave succeeds THEN system SHALL display a brief "Saved" indicator visible to the user
4. WHEN no changes have been made since the last successful save THEN system SHALL NOT trigger another save request
5. WHEN the diagram has not been created yet (new diagram) THEN the first autosave SHALL use `POST /api/diagrams` to create it, and all subsequent saves SHALL use `PUT`

**Independent Test**: Edit canvas → wait 2 seconds → `PUT /api/diagrams/:id` is called once → DB is updated.

---

### P1: Prevent concurrent save requests ⭐ MVP

**User Story**: As the system, I want to ensure only one save request is in-flight at a time so that rapid edits don't produce race conditions or out-of-order writes.

**Why P1**: Without this, rapid typing or drawing could send multiple concurrent PUTs that arrive out-of-order, causing an older state to overwrite a newer one.

**Acceptance Criteria**:

1. WHEN a save is in progress and new changes arrive THEN system SHALL cancel (abort) the in-flight request and reschedule the debounce timer
2. WHEN the aborted request receives a response THEN system SHALL ignore it and not treat it as a save success or failure
3. WHEN the debounce fires THEN system SHALL always send the most current canvas state — never a stale snapshot from before the abort
4. WHEN two autosave calls would overlap (debounce fires while previous save is still in-flight) THEN only the most recent call is sent

**Independent Test**: Rapidly type text for 3 seconds → only one network request is active at a time → final DB state reflects the last edit.

---

### P1: Save status indicator ⭐ MVP

**User Story**: As a user, I want to see ambient feedback about the save state so that I know my work is being persisted without having to think about it.

**Why P1**: Without feedback, users don't know if autosave is working. Silence after an error is worse than a failed manual save because users have no recovery path.

**Acceptance Criteria**:

1. WHEN a save is in progress THEN system SHALL display a "Saving…" indicator
2. WHEN a save completes successfully THEN system SHALL display "Saved" briefly (auto-hides after ~2 seconds)
3. WHEN a save fails THEN system SHALL display a persistent "Save failed — retry?" indicator that allows the user to manually trigger a retry
4. WHEN the diagram is in an unchanged state (no pending saves) THEN no save indicator SHALL be shown
5. WHEN the retry is triggered manually THEN the same save logic as autosave SHALL execute

**Independent Test**: Edit → "Saving…" appears → save succeeds → "Saved" appears → fades out.

---

### P2: Handle tab close with unsaved changes

**User Story**: As a user, I want to be warned or have my changes flushed before closing the tab so that I don't lose the last few seconds of drawing.

**Why P2**: Best-effort — the browser constrains what's possible here. Important for UX but doesn't block MVP.

**Acceptance Criteria**:

1. WHEN the user closes the tab or navigates away and a debounce save is pending THEN system SHALL attempt a best-effort synchronous flush (e.g. `navigator.sendBeacon` or `fetch` with `keepalive: true`)
2. WHEN a save is in-flight at tab close THEN system SHALL allow it to complete if the browser permits (keepalive)
3. WHEN the flush is not possible (browser blocks it) THEN the user MAY lose the last 1–2 seconds of changes — this is acceptable and documented

**Independent Test**: Draw → immediately close tab → reopen `/diagrams/:id` → most recent state is visible (or at worst, the state from 2 seconds ago).

---

### P2: Handle save failures gracefully

**User Story**: As a user, I want save failures to be surfaced clearly so that I can take action rather than silently losing work.

**Why P2**: Important UX but autosave itself (P1) is the primary goal. Error handling is polish.

**Acceptance Criteria**:

1. WHEN a save fails with a network error THEN system SHALL display the persistent error indicator (see save status story AC-3)
2. WHEN a save fails with `401` THEN system SHALL redirect the user to sign-in (session expired)
3. WHEN a save fails with `403` or `404` THEN system SHALL display a non-recoverable error state (the diagram ID is wrong or inaccessible)
4. WHEN a save fails with `5xx` THEN system SHALL allow retry — the diagram data is still in the editor and can be re-sent
5. WHEN save retry succeeds THEN system SHALL clear the error state and display "Saved"

**Independent Test**: Mock a network failure → error indicator appears → restore network → click retry → "Saved" appears.

---

## Edge Cases

- WHEN the user draws continuously for 30+ seconds THEN only one debounce-triggered save SHALL fire during inactive periods — autosave does not trigger mid-stroke
- WHEN the component unmounts (navigation away) with a pending debounce THEN the timer SHALL be cancelled to prevent a save call on an unmounted component
- WHEN the saved `data` field is identical to the previous save THEN system SHOULD skip the PUT request (diff check before sending — optimization, not required for MVP)
- WHEN the user is offline THEN saves SHALL fail gracefully; the error indicator appears and retries when the user re-engages

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| M2C-01 | P1: Autosave after drawing | Specify | Planned |
| M2C-02 | P1: Prevent concurrent requests | Specify | Planned |
| M2C-03 | P1: Save status indicator | Specify | Planned |
| M2C-04 | P2: Tab close flush | Specify | Planned |
| M2C-05 | P2: Handle save failures | Specify | Planned |

---

## Technical Notes

- Debounce: use `setTimeout` / `clearTimeout` in a `useCallback` or a custom `useSaveStatus` hook — keep debounce logic out of the component body
- Abort: use `AbortController` — create a new controller on each save attempt, abort the previous one before starting
- Tab close: `window.beforeunload` is unreliable for async; `navigator.sendBeacon` is the recommended approach for flush-on-close; `fetch` with `keepalive: true` is an alternative
- Save state machine: `idle | saving | saved | error` — drives the indicator UI; avoids boolean flag soup

---

## Success Criteria

- [ ] Drawing and stopping for 1–2s triggers exactly one PUT request
- [ ] Rapid edits produce only one in-flight request at a time (no concurrent PUTs)
- [ ] Save indicator cycles through: idle → saving → saved (or error)
- [ ] Network failure shows persistent error with retry; retry succeeds when network is restored
- [ ] Tab close with pending changes attempts a best-effort flush
