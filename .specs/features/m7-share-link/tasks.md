# Public Share Link Tasks

**Design**: `.specs/features/m7-share-link/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1 — Foundation (Sequential):
  T1 → T2

Phase 2 — API + Middleware (Sequential — integration not parallel-safe):
  T3 → T4

Phase 3 — UI Primitives (Parallel — unit, parallel-safe; no code deps):
  T5 [P], T6 [P]

Phase 4 — Wiring (Parallel — different files):
  T7 [P] (needs T2, T5), T8 [P] (needs T2, T6)

Phase 5 — E2E (Sequential — not parallel-safe):
  T9
```

```
T1 → T2 ──┬──────────────→ T3 → T4 ──────────────┐
          │                                        │
          │   (no dep) T5 [P] ─────────┐           │
          │   (no dep) T6 [P] ───────┐ │           │
          │                          │ │           │
          └── T2 done: ──────────────┼─┼─→ T7 [P] ─┤   (T7 needs T2+T5)
                                     │ └─→ T8 [P] ─┤   (T8 needs T2+T6)
                                     └─────────────┤
                          T3,T4,T7,T8 done: ───────→ T9
```

---

## Task Breakdown

### T1: Add `shareToken` to Diagram schema + migration

**What**: Add nullable unique `shareToken` column to the `Diagram` model, generate client, run migration.
**Where**: `prisma/schema.prisma`
**Depends on**: None
**Reuses**: Existing additive-migration pattern (e.g. `add_thumbnail` migration)
**Requirement**: SHARE-02, SHARE-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `shareToken String? @unique` added to `Diagram` model
- [ ] `prisma migrate dev --name add_diagram_share_token` ran successfully (additive, no backfill)
- [ ] `npx prisma generate` ran with no errors
- [ ] Gate check passes: `npm run build`

**Tests**: none (schema change — verified by build + migration success)
**Gate**: build

**Commit**: `feat(prisma): add shareToken to Diagram`

---

### T2: Add share data functions to `lib/diagrams.ts`

**What**: Add `shareDiagram`, `unshareDiagram`, `getDiagramByShareToken`; extend `getDiagramById` + `DiagramDetail` with `shareToken`.
**Where**: `lib/diagrams.ts`
**Depends on**: T1
**Reuses**: `db` client, `deserializeCanvas`, existing ownership-scoped query pattern in `getDiagramById`
**Requirement**: SHARE-02, SHARE-04, SHARE-05, SHARE-08, SHARE-11, SHARE-12, SHARE-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `shareDiagram(id, userId)`: mints `crypto.randomBytes(16).toString("base64url")` token; idempotent (returns existing token if already shared); ownership-scoped (returns `null` if not owned); retries on `P2002` collision (≤3)
- [ ] `unshareDiagram(id, userId)`: sets `shareToken` null; returns `false` if not owned
- [ ] `getDiagramByShareToken(token)`: `findUnique` with `select: { name: true, data: true }` ONLY — no `userId`, no relations; returns `null` on miss
- [ ] `getDiagramById` select gains `shareToken`; `DiagramDetail` type gains `shareToken: string | null`
- [ ] Integration test: share is idempotent (2 calls → same token); re-enable after unshare → **different** token (SHARE-13); unshare then lookup → null (SHARE-12); `getDiagramByShareToken` result has exactly `{ name, data }` keys — no `userId`/`tags`/`folderId` leak (SHARE-08); non-owner `shareDiagram`/`unshareDiagram` → null/false (SHARE-04)
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(lib): add share/unshare/lookup-by-token diagram functions`

---

### T3: `POST` + `DELETE /api/diagrams/:id/share` routes

**What**: New route file handling owner-authenticated share enable/revoke.
**Where**: `app/api/diagrams/[id]/share/route.ts` (new file)
**Depends on**: T2
**Reuses**: `requireSession` + null→403 pattern from `app/api/diagrams/[id]/route.ts`
**Requirement**: SHARE-02, SHARE-04, SHARE-05, SHARE-11, SHARE-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `POST` returns `200` `{ shareToken }`; idempotent (same token on repeat call)
- [ ] `DELETE` returns `204`
- [ ] Both return `403` when diagram not owned by session user
- [ ] Both return `401` when unauthenticated
- [ ] After `DELETE` then `POST` → new token differs from the revoked one
- [ ] Integration tests covering all above
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add share enable/revoke routes`

---

### T4: `GET /api/share/:token` public route + middleware allowlist

**What**: New public (no-auth) route returning `{ name, data }` by token; add `/share` + `/api/share` to the `authorized` allowlist so both are reachable unauthenticated.
**Where**: `app/api/share/[token]/route.ts` (new file), `auth.config.ts` (modify `authorized`)
**Depends on**: T2
**Reuses**: `getDiagramByShareToken` from T2; existing `authorized` callback structure
**Requirement**: SHARE-06, SHARE-08, SHARE-09, SHARE-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `authorized` returns `true` for paths starting `/share/` or `/api/share/` (alongside `/sign-in`, `/sign-up`)
- [ ] `GET /api/share/:token` returns `200` `{ name, data }` for a valid token — **unauthenticated request succeeds** (proves middleware allowlist)
- [ ] `GET /api/share/:token` returns `404` (not redirect, not 500) for missing / revoked / malformed token
- [ ] Response body has exactly `name` + `data` keys — no owner/relational leak
- [ ] Integration tests: unauth valid token → 200; unauth revoked token → 404; malformed token → 404; payload shape asserted
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add public share-by-token route + middleware allowlist`

---

### T5: `ShareCanvas` component [P]

**What**: Read-only Excalidraw render (`viewModeEnabled`) with a name header — no save/onChange/beforeunload/sidebar.
**Where**: `components/excalidraw/ShareCanvas.tsx` (new file)
**Depends on**: None
**Reuses**: `dynamic(..., { ssr: false })` mount pattern from `ExcalidrawEditor`; `ExcalidrawState` type
**Requirement**: SHARE-06, SHARE-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Mounts `<Excalidraw viewModeEnabled initialData={data} />`
- [ ] Renders `name` in a read-only header bar
- [ ] Contains NO `useSaveStatus`, NO `onChange` save wiring, NO `beforeunload` listener, NO `SaveIndicator`, NO sidebar
- [ ] Unit test: renders name; asserts no save-triggering handlers wired (viewMode prop passed)
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add read-only ShareCanvas component`

---

### T6: `ShareControl` component [P]

**What**: Owner editor control — enable/copy/revoke share link, with revoke confirmation and public-state indicator.
**Where**: `components/excalidraw/ShareControl.tsx` (new file)
**Depends on**: None
**Reuses**: 3-state confirm interaction (idle → confirm → done) from `SidebarItem` delete
**Requirement**: SHARE-01, SHARE-02, SHARE-03, SHARE-14, SHARE-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Props: `diagramId: string`, `initialShareToken: string | null`
- [ ] Private state → "Share" affordance, no public indicator (SHARE-15)
- [ ] Enable → `POST /api/diagrams/:id/share` → stores token, shows `${origin}/share/${token}` + "Copy link"
- [ ] "Copy link" calls `navigator.clipboard.writeText`; falls back to selectable text field if clipboard unavailable
- [ ] Shared state → shows persistent public indicator + URL + "Stop sharing"
- [ ] Revoke requires confirm step → `DELETE /api/diagrams/:id/share` → returns to private
- [ ] Re-open while shared shows existing URL (no new POST) — uses `initialShareToken`
- [ ] Unit tests (fetch + clipboard mocked): private↔shared transitions, copy invokes clipboard, revoke confirm gate, indicator visibility
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add ShareControl editor component`

---

### T7: Public `/share/[token]` page + not-found [P]

**What**: Server page outside `(app)` that fetches by token and renders `ShareCanvas`, plus a `not-found.tsx`.
**Where**: `app/share/[token]/page.tsx`, `app/share/[token]/not-found.tsx` (new files)
**Depends on**: T2, T5
**Reuses**: `getDiagramByShareToken` (T2); `notFound()` pattern; `ShareCanvas` (T5); root layout
**Requirement**: SHARE-06, SHARE-07, SHARE-09, SHARE-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `page.tsx` awaits `params`, calls `getDiagramByShareToken(token)`, `notFound()` if null, else `<ShareCanvas data name />`
- [ ] No `requireSession` — renders identically for anonymous and authenticated visitors (SHARE-10)
- [ ] `not-found.tsx` renders "This link is no longer available" (SHARE-09)
- [ ] TypeScript compiles
- [ ] Gate check passes: `npm run build`

**Tests**: none (server component plumbing — behavior covered by E2E T9)
**Gate**: build

**Commit**: `feat(page): add public /share/:token view page`

---

### T8: Wire `ShareControl` into editor [P]

**What**: Thread `shareToken` from `getDiagramById` through the diagram page + `ExcalidrawEditor`, rendering `ShareControl` in the editor chrome.
**Where**: `components/excalidraw/ExcalidrawEditor.tsx`, `app/(app)/diagrams/[id]/page.tsx`
**Depends on**: T2, T6
**Reuses**: Existing `ExcalidrawEditor` props threading; `getDiagramById` now returns `shareToken` (T2)
**Requirement**: SHARE-01, SHARE-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `ExcalidrawEditor` accepts `shareToken: string | null` and renders `<ShareControl diagramId initialShareToken>` as an overlay (near `SaveIndicator`)
- [ ] `page.tsx` passes `diagram.shareToken` to `<ExcalidrawEditor>`
- [ ] `ExcalidrawCanvas` itself unchanged (no save-path regression)
- [ ] Unit test: `ExcalidrawEditor` renders `ShareControl` with the passed `shareToken`
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(editor): surface ShareControl in the diagram editor`

---

### T9: E2E — share lifecycle

**What**: Playwright spec covering enable → copy → view unauthenticated → revoke → 404.
**Where**: `tests/e2e/share.spec.ts` (new file)
**Depends on**: T3, T4, T7, T8
**Reuses**: Existing auth fixtures/helpers in `tests/e2e/helpers.ts`; Playwright fresh-context (unauthenticated) for the public view
**Requirement**: SHARE-06, SHARE-07, SHARE-09, SHARE-10, SHARE-11, SHARE-12, SHARE-13, SHARE-14

**Tools**:
- MCP: `mcp__playwright__*` (interactive debugging if needed)
- Skill: NONE

**Done when**:
- [ ] Test: owner enables share → URL appears; copy affordance present
- [ ] Test: open share URL in a fresh unauthenticated context → read-only canvas + name render; no sidebar; editing disabled; no sign-in redirect
- [ ] Test: owner revokes (with confirm) → reload URL → "no longer available" 404 page
- [ ] Test: re-enable after revoke → new URL differs; old URL still 404s
- [ ] All tests pass: `npm run test:e2e -- --grep "share"`
- [ ] Gate check passes: `npm run lint && npm run test:e2e`

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): add share link lifecycle specs`

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: Prisma column + migration | 1 file + CLI | ✅ Granular |
| T2: share fns in lib/diagrams | 1 file, cohesive data layer | ✅ Granular |
| T3: share enable/revoke route | 1 new file, 2 methods (same route) | ✅ Granular |
| T4: public route + middleware allowlist | 1 new route + 1 tightly-coupled callback edit | ✅ Cohesive (allowlist is what makes the route reachable) |
| T5: ShareCanvas | 1 new component | ✅ Granular |
| T6: ShareControl | 1 new component | ✅ Granular |
| T7: public page + not-found | 2 new files, 1 route unit | ✅ Cohesive |
| T8: editor wiring | 2 files, 1 concern (prop threading) | ✅ Granular |
| T9: E2E share | 1 spec file, 1 feature | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Start of chain | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T2 | T3 → T4 (after T3, integration serial) | ✅ Match |
| T5 | None | branches early, no dep | ✅ Match |
| T6 | None | branches early, no dep | ✅ Match |
| T7 | T2, T5 | T2+T5 → T7 [P] | ✅ Match |
| T8 | T2, T6 | T2+T6 → T8 [P] | ✅ Match |
| T9 | T3, T4, T7, T8 | T3,T4,T7,T8 → T9 | ✅ Match |

**Parallel-safety**: T5/T6 are unit (parallel-safe), no shared files, no deps → `[P]` valid. T7 (build gate) + T8 (unit) touch different files → `[P]` valid. T3/T4 are integration (NOT parallel-safe) → sequential, no `[P]`.

---

## Test Co-location Validation

| Task | Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Prisma schema / migration | none | none | ✅ OK |
| T2 | `lib/diagrams.ts` (Prisma queries) | Integration | integration | ✅ OK |
| T3 | `app/api/diagrams/[id]/share/route.ts` | Integration | integration | ✅ OK |
| T4 | public API route + middleware (`auth.config.ts`) | Integration (+E2E) | integration (E2E in T9) | ✅ OK |
| T5 | `components/excalidraw/ShareCanvas.tsx` | Unit (+E2E) | unit (E2E in T9) | ✅ OK |
| T6 | `components/excalidraw/ShareControl.tsx` | Unit (+E2E) | unit (E2E in T9) | ✅ OK |
| T7 | `app/share/[token]/page.tsx` (server plumbing) | none | none | ✅ OK |
| T8 | `components/excalidraw/ExcalidrawEditor.tsx` | Unit (+E2E) | unit (E2E in T9) | ✅ OK |
| T9 | `tests/e2e/share.spec.ts` | E2E | e2e | ✅ OK |

**Note on middleware**: matrix requires Integration + E2E for middleware. T4's integration test issues an **unauthenticated** request to `/api/share/:token` and asserts `200` — this directly exercises the `authorized` allowlist (a failing allowlist would 401/redirect). E2E coverage of the public path lands in T9. No middleware behavior is left unverified.

---

## Requirement Traceability

| Req ID | Tasks |
|---|---|
| SHARE-01 | T6, T8 + T9 |
| SHARE-02 | T2, T3, T6 |
| SHARE-03 | T6 |
| SHARE-04 | T2, T3 |
| SHARE-05 | T2, T3, T6 |
| SHARE-06 | T2, T4, T5, T7 + T9 |
| SHARE-07 | T5, T7 + T9 |
| SHARE-08 | T2, T4 |
| SHARE-09 | T4, T7 + T9 |
| SHARE-10 | T7 + T9 |
| SHARE-11 | T2, T3 + T9 |
| SHARE-12 | T2, T4 + T9 |
| SHARE-13 | T2, T3 + T9 |
| SHARE-14 | T6 + T9 |
| SHARE-15 | T6, T8 (P2) |

**Coverage**: 15/15 requirements mapped (SHARE-15 is P2 — included, not deferred).

---

## MCP / Skill note

Only T9 benefits from a tool: `mcp__playwright__*` for interactive E2E debugging. All other tasks are plain file edits + Prisma CLI — no MCP or Skill needed. Confirm before Execute if you want a different tool assignment.
