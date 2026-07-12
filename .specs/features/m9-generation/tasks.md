# Generation Layer (spec → Excalidraw) Tasks

**Design**: `.specs/features/m9-generation/design.md`
**Context/Decisions**: `.specs/features/m9-generation/context.md`
**Status**: Implemented (T1–T5 verified green; T6 written, blocked by pre-existing build issue)

---

## Implementation Notes

- **T1 spike outcome** (context.md D1 + D6): `@excalidraw/excalidraw` cannot run server-side
  (importing it evaluates the whole editor). Resolved by parsing Mermaid headless (jsdom + stubbed
  SVG metrics) and hand-converting the geometry skeleton — no excalidraw runtime dep.
- **T2–T5 verified green**: 22 unit tests (conversion, node-env headless path, deterministic
  normalization, multi-type fixtures) + 11 integration tests (createDiagram folderId 3, from-spec
  route 8) all pass against the real test Postgres. Lint: 0 errors. `next build` **type-check passes**
  for all M9 code.
- **T6 E2E is written but blocked by a pre-existing, environment-level failure**: `next build` (and
  thus the Playwright `webServer = next build && next start`) fails resolving `next/font/google`
  (Geist Mono) from `app/layout.tsx` — a file M9 does not touch, offline in this sandbox (same
  blocker M8's T9 hit). The spec will run on CI / a network-available env.
- **Known limitation** (D6): flowcharts with edge labels (`-->|text|`) fail gracefully (400) under
  headless jsdom; asserted by an explicit test. Label-free flowcharts, sequence, class convert fully;
  ER converts minimally.

---

## ⚠️ Gate: T1 is load-bearing

T1 is a **spike that decides the conversion runtime** (context.md D1). Do not start T2+ until T1
confirms `parseMermaidToExcalidraw` + `convertToExcalidrawElements` run headless and produce valid,
binding-intact elements. If T1 escalates from jsdom (Option A) to headless Chromium (Option B), only
T2's internals change — T3–T6 are runtime-agnostic.

---

## Execution Plan

```
Phase 1 — Runtime spike (gate):
  T1  (decides Option A vs B; installs deps)

Phase 2 — Conversion core (sequential — depends on the spike outcome):
  T1 → T2

Phase 3 — Persistence + route (integration, NOT parallel-safe → sequential):
  T2 → T3 → T4

Phase 4 — Validation suite (unit, parallel-safe):
  T2 → T5 [P]   (independent of T3/T4; no DB, no shared files)

Phase 5 — E2E (sequential — not parallel-safe):
  T4 → T6
```

```
T1 → T2 ─┬─→ T3 → T4 ───────────────→ T6
         └─→ T5 [P]
```

Integration and E2E suites are NOT parallel-safe (shared test DB/app — TESTING.md Parallelism
Assessment) → run sequentially. Only T5 (unit, no DB) carries `[P]`.

---

## Task Breakdown

### T1: Spike — headless conversion runtime + install deps ⚠️ GATE

**What**: Prove both upstream calls run server-side and pick the runtime (context.md D1). Install
`@excalidraw/mermaid-to-excalidraw` (pin version); add `jsdom` if not already resolvable. Write a
throwaway script/test that runs `parseMermaidToExcalidraw("flowchart TD\nA-->B")` →
`convertToExcalidrawElements(...)` in **Node** (not a browser) and dumps the elements.
**Where**: `package.json`, a scratch `tests/unit/lib/spec-to-excalidraw.spike.test.ts` (kept or deleted per outcome)
**Depends on**: None
**Reuses**: Excalidraw two-step API (design.md; context.md D1 links)
**Requirement**: GEN-05, GEN-06, GEN-16

**Tools**:
- MCP: Context7 (resolve `@excalidraw/mermaid-to-excalidraw` current API before coding)
- Skill: NONE

**Done when**:
- [ ] `@excalidraw/mermaid-to-excalidraw` installed at a pinned version; API signature re-verified against docs (Knowledge Verification Chain)
- [ ] A Node-context test converts `flowchart TD\nA-->B` and produces elements that include the two nodes + one arrow, WITHOUT a browser
- [ ] DECISION recorded in context.md D1: Option A (jsdom shim) confirmed, or escalate to Option B (headless Chromium) with the failing evidence (which SVG/measurement API broke)
- [ ] If jsdom: `getComputedTextLength`/`getBBox` stub approach validated (nodes get non-zero, deterministic sizes)
- [ ] Mermaid initialized with `securityLevel: "strict"` verified (no script/click execution)
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit (spike proof)
**Gate**: quick

**Commit**: `chore(m9): spike headless mermaid→excalidraw conversion runtime`

---

### T2: `lib/spec-to-excalidraw.ts` — conversion + deterministic normalization

**What**: The conversion module: parse → convert → `normalizeDeterministic` → `deserializeCanvas`
sanity check, throwing `SpecParseError` on bad input. Hosts the T1-chosen runtime behind
`specToExcalidraw(spec, format)`.
**Where**: `lib/spec-to-excalidraw.ts` (new)
**Depends on**: T1
**Reuses**: `ExcalidrawState`/`ExcalidrawElement` + `deserializeCanvas` (`lib/excalidraw.ts`); `node:crypto`; T1 runtime
**Requirement**: GEN-05, GEN-06, GEN-07, GEN-08, GEN-09, GEN-10, GEN-11, GEN-12, GEN-15, GEN-16, GEN-17

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `SpecParseError extends Error` with a client-safe message (no stack leak)
- [ ] `specToExcalidraw(spec, "mermaid")`: parse → `convertToExcalidrawElements` → `normalizeDeterministic` → `deserializeCanvas`; returns `ExcalidrawState`; carries `files` through (GEN-17)
- [ ] Throws `SpecParseError` on: unsupported format, invalid Mermaid syntax, zero-element result (D5)
- [ ] `normalizeDeterministic(elements)` is a **pure** exported (or test-visible) fn: deterministic `id`/`seed`/`versionNonce` from `sha256(type+geom+text+ordinal)`; `version=1`, `updated=0` (no `Date.now()`); ascending fractional `index`; rewrites `boundElements`/`startBinding`/`endBinding`/`groupIds`/`frameId` (GEN-08/10/11/12)
- [ ] **Unit tests** (jsdom env, no DB): convert `flowchart TD\nA-->B` → 2 nodes + 1 arrow; arrow `startBinding`/`endBinding` reference the node ids and both nodes' `boundElements` include the arrow (GEN-07); required fields present (GEN-06); output survives `deserializeCanvas` unchanged in count (GEN-09); **same spec twice → deep-equal** (GEN-10); no binding references a missing id (GEN-12); duplicate-label nodes get distinct ids
- [ ] **Unit tests**: invalid syntax → `SpecParseError`; empty spec → `SpecParseError`; `normalizeDeterministic` on a fixture rewrites all cross-refs (pure, no runtime)
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(lib): mermaid→excalidraw conversion with deterministic normalization`

---

### T3: Extend `createDiagram` with optional `folderId`

**What**: Additive `folderId` param on `createDiagram` so create-from-spec can attach in one call.
**Where**: `lib/diagrams.ts`
**Depends on**: None (independent lib change; sequenced after T2 only for integration serialization)
**Reuses**: existing `createDiagram` body; `db`
**Requirement**: GEN-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `createDiagram(userId, name?, data?, folderId?: string | null)` sets `folderId` on the created row when provided; omitting it is unchanged behavior
- [ ] Return shape (`DiagramDetail`) unchanged; existing callers keep compiling (param optional)
- [ ] **Integration tests**: create with a valid owned `folderId` → row has that `folderId`; create without → `folderId` null (regression); existing `POST /api/diagrams` tests still green
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(lib): createDiagram accepts optional folderId`

---

### T4: `POST /api/diagrams/from-spec` route

**What**: HTTP shell — actor auth → Zod validate → folder-ownership check → `specToExcalidraw` →
`createDiagram` → `201 DiagramDetail`; graceful `400`/`401`.
**Where**: `app/api/diagrams/from-spec/route.ts` (new)
**Depends on**: T2, T3
**Reuses**: `POST /api/diagrams` structure; `requireActor`; `specToExcalidraw` (T2); `createDiagram` (T3); owner-scoped folder lookup (`lib/folders.ts`); `zod`
**Requirement**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-13, GEN-14, GEN-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `POST` parses `{ name?, folderId?, spec, format }` with `FromSpecSchema` (`format` = `z.literal("mermaid")`); invalid body / non-string spec / bad format → 400 (GEN-13/14)
- [ ] `requireActor(req)` → 401 when unauthenticated; ownership derived from actor, never body (GEN-03)
- [ ] `folderId` present but not owned/found → 400, no row written (GEN-04)
- [ ] `SpecParseError` from conversion → 400 JSON, no row written (GEN-15)
- [ ] Success → `createDiagram(actor.userId, name, data, folderId)` → `201 DiagramDetail`; default name when omitted (GEN-02); `data` is the converted state
- [ ] No `auth.config.ts` change needed (bearer already allowed for `/api/*`); confirm a bearer request reaches the handler
- [ ] **Integration tests**: session AND bearer valid spec → 201, diagram retrievable via `GET /api/diagrams/:id` by same user (GEN-01); no-auth → 401 (GEN-03); garbage spec → 400 + DB count unchanged (GEN-15); `format:"svg"` → 400 (GEN-14); unowned `folderId` → 400 + no row (GEN-04); cross-user isolation (bearer for A cannot create in B's folder)
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): POST /api/diagrams/from-spec`

---

### T5: Conversion validation suite (multi-type fixtures) [P]

**What**: Fixture-driven suite: one spec per supported Mermaid type in → `deserializeCanvas` →
assert elements valid + bindings intact; plus the graceful-400 boundary. Fulfills the roadmap's
"Conversion Validation" feature.
**Where**: `tests/unit/lib/spec-to-excalidraw.fixtures.test.ts` (new) + `tests/fixtures/mermaid/*.mmd`
**Depends on**: T2 (no dep on T3/T4; no DB, no shared files → `[P]`)
**Reuses**: `specToExcalidraw` (T2); `deserializeCanvas` (`lib/excalidraw.ts`)
**Requirement**: GEN-07, GEN-09, GEN-10, GEN-15, GEN-18, GEN-19

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Fixtures for each type the upstream lib supports: flowchart, sequence, class, ER (skip/mark any unsupported with an explicit note — no silent gap)
- [ ] Per fixture: `specToExcalidraw` → `deserializeCanvas` returns a valid `ExcalidrawState`; every element has required fields; every binding references an existing element id (GEN-07/09/19)
- [ ] Determinism: each fixture converted twice is deep-equal (GEN-10)
- [ ] Graceful failure: a garbage fixture and an unsupported-type fixture both throw `SpecParseError` (GEN-15/18)
- [ ] Any type the lib cannot handle is logged in the suite output, not silently omitted
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `test(m9): conversion validation suite across mermaid types`

---

### T6: E2E — generate from spec opens in the editor

**What**: Playwright spec: authenticate, POST a spec to `from-spec` via the request context, open the
returned diagram id in the editor, assert it renders with no console/render error.
**Where**: `tests/e2e/from-spec.spec.ts` (new)
**Depends on**: T4
**Reuses**: existing auth fixtures/helpers in `tests/e2e/`; Playwright `request` context (raw HTTP, like the M8 bearer e2e)
**Requirement**: GEN-01, GEN-03, GEN-09

**Tools**:
- MCP: `mcp__playwright__*` (interactive debugging only if needed)
- Skill: NONE

**Done when**:
- [ ] Sign in → `request.post('/api/diagrams/from-spec', { spec:"flowchart TD\nA-->B", format:"mermaid" })` → 201 with an id (GEN-01)
- [ ] Navigate to `/diagrams/:id` → Excalidraw canvas renders; no uncaught console error / no render throw (GEN-09)
- [ ] An unauthenticated `from-spec` request → 401 (GEN-03 boundary)
- [ ] All tests pass: `npm run test:e2e -- --grep "from-spec"`
- [ ] Gate check passes: `npm run lint && npm run test:e2e`

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): generate diagram from spec`

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: runtime spike + deps | 1 scratch test + package.json | ✅ Granular (gate) |
| T2: `lib/spec-to-excalidraw.ts` | 1 new file, cohesive convert+normalize | ✅ Granular |
| T3: `createDiagram` folderId | 1 file, 1 additive param | ✅ Granular |
| T4: `from-spec` route | 1 new file, 1 endpoint | ✅ Granular |
| T5: validation suite | 1 test file + fixtures | ✅ Granular |
| T6: E2E | 1 spec file | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | start of chain | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | (T2 for sequencing) | T2 → T3 | ✅ Match |
| T4 | T2, T3 | T3 → T4 | ✅ Match |
| T5 | T2 | T2 → T5 `[P]` | ✅ Match |
| T6 | T4 | T4 → T6 | ✅ Match |

**Parallel-safety**: T5 is unit, no DB, no shared files, depends only on T2 code → `[P]` valid. All
other tasks are integration/e2e (not parallel-safe per TESTING.md) → sequential. No two `[P]` tasks
share mutable state (only T5 is `[P]`).

---

## Test Co-location Validation

| Task | Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | spike scratch | none (spike) | unit proof | ✅ OK |
| T2 | `lib/spec-to-excalidraw.ts` — conversion + pure normalize | Unit (lib) | unit | ✅ OK |
| T3 | `lib/diagrams.ts` — Prisma create | Integration (DB) | integration | ✅ OK |
| T4 | `app/api/diagrams/from-spec/route.ts` | Integration | integration (E2E in T6) | ✅ OK |
| T5 | conversion validation (lib, no DB) | Unit | unit | ✅ OK |
| T6 | `tests/e2e/from-spec.spec.ts` | E2E | e2e | ✅ OK |

**Note**: `lib/**` is Unit per the matrix; the conversion module runs in the jsdom unit env, which
supplies the DOM the upstream libs need — so the whole pipeline is unit-testable with no browser and
no DB (GEN-16). DB-touching work (create) is isolated in T3/T4 (Integration). The route's real
"opens in canvas" proof lands in T6 (E2E).

---

## Requirement Traceability

| Req ID | Tasks |
|---|---|
| GEN-01 | T4 + T6 |
| GEN-02 | T4 |
| GEN-03 | T4 + T6 |
| GEN-04 | T3, T4 |
| GEN-05 | T1, T2 |
| GEN-06 | T1, T2 |
| GEN-07 | T2, T5 |
| GEN-08 | T2 |
| GEN-09 | T2, T5 + T6 |
| GEN-10 | T2, T5 |
| GEN-11 | T2 |
| GEN-12 | T2 |
| GEN-13 | T4 |
| GEN-14 | T4 |
| GEN-15 | T2, T4, T5 |
| GEN-16 | T1, T2 |
| GEN-17 | T2 |
| GEN-18 | T5 |
| GEN-19 | T5 |

**Coverage**: 19/19 requirements mapped to tasks (GEN-18 is P2 — included, not deferred).

---

## MCP / Skill note

Only T1 benefits from a tool: **Context7** to re-verify the `@excalidraw/mermaid-to-excalidraw` API at
install time (Knowledge Verification Chain), and `mcp__playwright__*` for optional T6 debugging. Every
other task is plain file edits + Vitest — no MCP or Skill needed.
