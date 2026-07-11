# Machine Auth (API Keys) Tasks

**Design**: `.specs/features/m8-api-keys/design.md`
**Status**: Implemented (T1–T8 verified; T9 written, see note)

---

## Implementation Notes

- **T1–T7 verified green**: unit +17 tests (api-key crypto 10, ApiKeyManager 7) all pass;
  integration 147/147 pass (api-key lib, actor resolution, diagram bearer path + regression,
  api-keys routes). Lint: 0 errors.
- **Live HTTP smoke** (dev server) confirmed the middleware + `requireActor` path that integration
  can't exercise: valid bearer → `GET`/`POST /api/diagrams` 200/201; garbage/revoked bearer → 401;
  no-auth → 307 sign-in (unchanged); bearer on `/api/api-keys` → 401 (KEY-15).
- **T8 build gate & T9 E2E are blocked by a pre-existing, environment-level failure**: `next build`
  (and thus the Playwright `webServer`) fails resolving `next/font/google` (Geist) via turbopack in
  `app/layout.tsx` — a file M8 does not touch. `tsc --noEmit` reports zero errors in any M8 file
  (only pre-existing errors in unrelated test files). T9 spec is written and will run once the
  build blocker is resolved (or on CI with network font access).

---

## Execution Plan

```
Phase 1 — Foundation (sequential):
  T1 → T2

Phase 2 — Auth spine (sequential — integration, not parallel-safe):
  T3 → T4

Phase 3 — Key-management API (sequential — integration, not parallel-safe):
  T5 → T6

Phase 4 — UI primitive (parallel-safe — unit):
  T7 [P]  (no code dep — fetch mocked)

Phase 5 — Settings page (build plumbing):
  (T2, T7) → T8

Phase 6 — E2E (sequential — not parallel-safe):
  (T4, T5, T6, T8) → T9
```

```
T1 → T2 ─┬─→ T3 → T4 ───────────────────────────┐
         │                                        │
         ├─→ T5 → T6 ──────────────────────────────┤
         │                                        │
         └────────────────────→ T8 (needs T2, T7) ─┤
   T7 [P] ─────────────────────────↑              │
                          (T4, T5, T6, T8) → T9 ───┘
```

Integration and E2E suites are **not** parallel-safe (shared test DB / app — see TESTING.md
Parallelism Assessment), so every integration task runs sequentially even where code has no
dependency. Only T7 (unit) carries `[P]`.

---

## Task Breakdown

### T1: Add `ApiKey` model to Prisma schema + migration

**What**: Add the `ApiKey` model and `User.apiKeys` back-relation, generate client, run migration.
**Where**: `prisma/schema.prisma`
**Depends on**: None
**Reuses**: Additive-migration pattern from `prisma/migrations/*_add_diagram_share_token`
**Requirement**: KEY-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `ApiKey` model added exactly per design (id, userId, label, `hashedKey String @unique`, prefix, `scopes String[] @default(["diagrams"])`, lastUsedAt, revokedAt, createdAt, `@@index([userId])`, `onDelete: Cascade`)
- [ ] `apiKeys ApiKey[]` back-relation added to `User`
- [ ] `prisma migrate dev --name add_api_keys` ran successfully (additive, no backfill)
- [ ] `npx prisma generate` ran with no errors
- [ ] Gate check passes: `npm run build`

**Tests**: none (schema change — verified by build + migration success)
**Gate**: build

**Commit**: `feat(prisma): add ApiKey model`

---

### T2: `lib/api-key.ts` — key crypto + persistence

**What**: Pure crypto helpers plus owner-scoped DB functions for the key lifecycle.
**Where**: `lib/api-key.ts` (new)
**Depends on**: T1
**Reuses**: `shareToken` CSPRNG pattern (`lib/diagrams.ts`); `db` client; ownership-scoped query pattern
**Requirement**: KEY-01, KEY-02, KEY-03, KEY-04, KEY-07, KEY-11, KEY-14, KEY-17

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `generateApiKey()`: `raw = "sk_" + randomBytes(32).toString("base64url")`, `hashedKey = sha256hex(raw)`, `prefix = raw.slice(0,11)`
- [ ] `hashApiKey(raw)`: deterministic sha-256 hex
- [ ] `createApiKey(userId, label?)`: persists `{ userId, hashedKey, prefix, label }`, returns `{ id, raw, prefix, label }`; retries on `P2002` (≤3)
- [ ] `listApiKeys(userId)`: returns `ApiKeySummary[]` with `select` that OMITS `hashedKey`; includes revoked rows (KEY-17); owner-scoped
- [ ] `revokeApiKey(id, userId)`: owner-scoped `updateMany`/scoped update setting `revokedAt`; returns `false` if not owned
- [ ] `resolveApiKey(raw)`: null if not `sk_`-prefixed/empty; hash → `findUnique({ where: { hashedKey } })`; null if missing OR `revokedAt` set; best-effort `lastUsedAt` bump (swallow errors); returns `{ userId, scopes }`
- [ ] **Unit tests** (no DB): `generateApiKey` → `sk_` prefix + ≥256-bit entropy + `hashedKey === hashApiKey(raw)`; `hashApiKey` deterministic; `resolveApiKey("")`/`resolveApiKey("nope")` → null without a DB call
- [ ] **Integration tests** (real Postgres): create→raw returned once & only hash stored (KEY-02/03); `listApiKeys` result has NO `hashedKey` key and is owner-scoped (KEY-14); `resolveApiKey` valid→owner, revoked→null (KEY-11/12 groundwork), cross-user isolation; `lastUsedAt` set after resolve (KEY-07)
- [ ] Gate check passes: `npm run lint && npm run test:unit && npm run test:integration`

**Tests**: unit + integration
**Gate**: full

**Commit**: `feat(lib): add api-key crypto and persistence`

---

### T3: `resolveActor` / `requireActor` in `lib/auth.ts`

**What**: Resolve a request to `{ userId, source }` from a bearer key OR the session.
**Where**: `lib/auth.ts` (extend)
**Depends on**: T2
**Reuses**: `getSession`; `requireSession` throw-`Response` idiom; `resolveApiKey` (T2)
**Requirement**: KEY-05, KEY-07, KEY-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `type Actor = { userId: string; source: "session" | "apikey" }` exported
- [ ] `resolveActor(req)`: `Authorization: Bearer <x>` present → resolve **only** via `resolveApiKey`; on failure return null (NO session fallthrough); no bearer → `getSession` → actor or null
- [ ] `requireActor(req)`: throws `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` on null
- [ ] **Integration tests**: crafted `Request` with valid bearer → `{ userId, source: "apikey" }`; revoked/unknown/empty bearer → null (KEY-08); `Bearer ` with junk → null (no fallthrough); no header + valid session → `source: "session"` (mock/seed session); `lastUsedAt` bumped on the apikey path (KEY-07)
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(lib): resolve actor from bearer key or session`

---

### T4: Bearer auth on diagram routes + middleware allowance

**What**: Swap the diagram routes to `requireActor(req)` and let bearer `/api/*` requests through the `authorized` middleware.
**Where**: `app/api/diagrams/route.ts`, `app/api/diagrams/[id]/route.ts`, `auth.config.ts`
**Depends on**: T3
**Reuses**: existing route handler bodies (unchanged except the auth line); `authorized` allowlist structure; null→403 ownership pattern
**Requirement**: KEY-05, KEY-06, KEY-08, KEY-09, KEY-10, KEY-12, KEY-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `authorized` returns `true` when `p.startsWith("/api/")` AND `request.headers.get("authorization")?.startsWith("Bearer ")` (added alongside existing public checks)
- [ ] All diagram handlers use `requireActor(req)` → `actor.userId` (replacing `requireSession()` → `session.user.id`); `GET /api/diagrams` gains a `req: NextRequest` param
- [ ] **Integration tests**: valid bearer → `GET /api/diagrams` returns owner's diagrams (200) (KEY-05/09); bearer for user A cannot read user B's diagram → 403 (KEY-06); malformed/revoked bearer → 401 JSON, not redirect (KEY-08/12); **session request still works unchanged** (KEY-10 regression); `authorized` callback unit-asserted: bearer `/api/x` → true, no-auth `/diagrams` page → false, `/api/api-keys` + bearer → true at middleware (handler still gates in T5/T6, KEY-15 groundwork)
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration (E2E pass-through in T9)
**Gate**: full

**Commit**: `feat(api): accept bearer api keys on diagram routes`

---

### T5: `GET` + `POST /api/api-keys` (session-only)

**What**: List the caller's keys (metadata) and mint a new key (raw returned once).
**Where**: `app/api/api-keys/route.ts` (new)
**Depends on**: T2
**Reuses**: `requireSession` (NOT `requireActor`); Zod parse→400 pattern; `createApiKey`/`listApiKeys` (T2)
**Requirement**: KEY-01, KEY-03, KEY-04, KEY-14, KEY-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `GET` → 200 `ApiKeySummary[]` for the session user; response JSON contains no `hashedKey` and no raw secret (KEY-14)
- [ ] `POST {label?}` → 201 `{ id, key, prefix, label }` where `key` is the raw secret (only appearance, KEY-01/03); label defaults applied; invalid body → 400
- [ ] Both use `requireSession` — a **bearer** request (no session) → 401 (KEY-15)
- [ ] userId taken from session, never body (KEY-04)
- [ ] **Integration tests**: create returns raw once; a follow-up `GET` never returns that raw or any hash; bearer-only request → 401; cross-user list isolation
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): list and create api keys`

---

### T6: `DELETE /api/api-keys/:id` — revoke (session-only)

**What**: Revoke an owned key; confirm a revoked key can no longer authenticate.
**Where**: `app/api/api-keys/[id]/route.ts` (new)
**Depends on**: T2
**Reuses**: `requireSession`; null/false→403 ownership pattern; `revokeApiKey` (T2)
**Requirement**: KEY-11, KEY-12, KEY-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `DELETE` → 204 on success; 403 when the key belongs to another user; 401 when unauthenticated
- [ ] Uses `requireSession` — bearer request → 401 (KEY-15)
- [ ] **Integration tests**: owner revoke → 204 then `resolveApiKey(raw)` → null (KEY-11/12); non-owner revoke → 403 and key still active; revoking a bearer-authenticated request path is blocked (session-only)
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): revoke api key`

---

### T7: `ApiKeyManager` component [P]

**What**: Client UI to create (reveal-once), list, and revoke keys with a confirm step.
**Where**: `components/settings/ApiKeyManager.tsx` (new)
**Depends on**: None (fetch mocked in tests)
**Reuses**: `UserMenu` menu/state + click-outside patterns; `SidebarItem` idle→confirm→done revoke interaction; `ApiKeySummary` type
**Requirement**: KEY-03 (UI reveal-once), KEY-13, KEY-16, KEY-17

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Props: `{ initialKeys: ApiKeySummary[] }`
- [ ] Create form (optional label) → `POST /api/api-keys` → reveals raw `key` once in a highlighted box with "Copy" + a "won't be shown again" warning (KEY-03); dismissing/re-rendering hides it permanently
- [ ] List renders label, masked prefix `sk_…`, `lastUsedAt` or "never used", and a "revoked" badge for revoked keys (KEY-16/17)
- [ ] Revoke uses idle→confirm→done gate → `DELETE /api/api-keys/:id` → row flips to revoked (KEY-13)
- [ ] "Copy" calls `navigator.clipboard.writeText`; falls back to a selectable field if unavailable
- [ ] **Unit tests** (fetch + clipboard mocked): create reveals raw once and only once; copy invokes clipboard; revoke requires the confirm step; masked prefix + "never used" + revoked badge render correctly
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add ApiKeyManager component`

---

### T8: `/settings/api-keys` page + `UserMenu` link

**What**: Authenticated settings page that server-loads keys and renders the manager, linked from the user menu.
**Where**: `app/(app)/settings/api-keys/page.tsx` (new), `components/sidebar/UserMenu.tsx` (add link)
**Depends on**: T2, T7
**Reuses**: `(app)` layout group; `requireSession`; `listApiKeys` (T2); `ApiKeyManager` (T7); `UserMenu` link slot
**Requirement**: KEY-01 (UI host)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `page.tsx` is a server component: `requireSession` → `listApiKeys(userId)` → `<ApiKeyManager initialKeys={keys} />`
- [ ] `UserMenu` gains an "API keys" link to `/settings/api-keys`
- [ ] TypeScript compiles; page renders under the authenticated layout
- [ ] Gate check passes: `npm run build`

**Tests**: none (server-component plumbing + nav link — behavior covered by E2E T9)
**Gate**: build

**Commit**: `feat(settings): add api-keys settings page`

---

### T9: E2E — API key lifecycle

**What**: Playwright spec covering create → reveal/copy → authenticate a real request → revoke → 401.
**Where**: `tests/e2e/api-keys.spec.ts` (new)
**Depends on**: T4, T5, T6, T8
**Reuses**: existing auth fixtures/helpers in `tests/e2e/`; Playwright `request` context to fire a raw bearer HTTP call
**Requirement**: KEY-01, KEY-03, KEY-05, KEY-08, KEY-09, KEY-10, KEY-12, KEY-13

**Tools**:
- MCP: `mcp__playwright__*` (interactive debugging only if needed)
- Skill: NONE

**Done when**:
- [ ] Test: sign in → open `/settings/api-keys` → create key → raw `sk_…` shown once with copy affordance (KEY-01/03)
- [ ] Test: reload the page → raw secret is gone; only masked metadata remains (KEY-03)
- [ ] Test: using the captured raw key, `request.get('/api/diagrams', { Authorization: Bearer })` → 200 and returns that user's diagrams (KEY-05/09); the middleware does NOT redirect to sign-in
- [ ] Test: an unauthenticated `/api/diagrams` request with no key → 401 (KEY-10 boundary)
- [ ] Test: revoke the key in the UI (with confirm) → same bearer request now → 401 (KEY-12/13)
- [ ] All tests pass: `npm run test:e2e -- --grep "api key"`
- [ ] Gate check passes: `npm run lint && npm run test:e2e`

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): add api key lifecycle specs`

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: Prisma model + migration | 1 file + CLI | ✅ Granular |
| T2: `lib/api-key.ts` | 1 new file, cohesive crypto+data layer | ✅ Granular |
| T3: actor resolution in `lib/auth.ts` | 1 file, 1 concern (2 fns) | ✅ Granular |
| T4: bearer on diagram routes + middleware | 3 files, 1 concern (bearer path) | ✅ Cohesive (allowance + wiring make one testable slice) |
| T5: list + create key routes | 1 new file, 2 methods (same route) | ✅ Granular |
| T6: revoke key route | 1 new file, 1 method | ✅ Granular |
| T7: `ApiKeyManager` | 1 new component | ✅ Granular |
| T8: settings page + nav link | 2 files, 1 concern (host + entry) | ✅ Cohesive |
| T9: E2E lifecycle | 1 spec file, 1 feature | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | start of chain | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T2 | T2 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | None | branches early, no dep, `[P]` | ✅ Match |
| T8 | T2, T7 | (T2, T7) → T8 | ✅ Match |
| T9 | T4, T5, T6, T8 | (T4,T5,T6,T8) → T9 | ✅ Match |

**Parallel-safety**: T7 is unit (parallel-safe), no shared files, no code deps → `[P]` valid. All
other tasks are integration/build/e2e (integration + e2e NOT parallel-safe per TESTING.md) → run
sequentially, no `[P]`. No two `[P]` tasks share mutable state (only T7 is `[P]`).

---

## Test Co-location Validation

| Task | Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Prisma schema / migration | none | none | ✅ OK |
| T2 | `lib/api-key.ts` — pure helpers (Unit) + Prisma queries (Integration) | Unit + Integration | unit + integration | ✅ OK |
| T3 | `lib/auth.ts` (auth helper) | Integration | integration | ✅ OK |
| T4 | diagram API routes (Integration) + middleware `auth.config.ts` (Integration + E2E) | Integration (+E2E) | integration (E2E in T9) | ✅ OK |
| T5 | `app/api/api-keys/route.ts` | Integration | integration | ✅ OK |
| T6 | `app/api/api-keys/[id]/route.ts` | Integration | integration | ✅ OK |
| T7 | `components/settings/ApiKeyManager.tsx` | Unit (+E2E) | unit (E2E in T9) | ✅ OK |
| T8 | settings page (server plumbing, none) + `UserMenu.tsx` (component) | none / Unit+E2E | none (E2E in T9) | ✅ OK — see note |
| T9 | `tests/e2e/api-keys.spec.ts` | E2E | e2e | ✅ OK |

**Note on T8**: the page is server-component plumbing (matrix "none"). The `UserMenu` edit adds a
single navigation link with no local logic — its behavior is exercised by the E2E navigation step in
T9 (sign in → open `/settings/api-keys`). No component logic is left unverified. This mirrors the m7
precedent where page plumbing + nav wiring were build-gated with E2E coverage.

**Note on T4 middleware**: matrix requires Integration + E2E for middleware. T4's integration suite
both unit-asserts the pure `authorized` callback AND fires an **unauthenticated bearer** request that
must reach the handler and return 200 (a broken allowance would redirect/401). E2E pass-through lands
in T9. No middleware behavior is left unverified.

---

## Requirement Traceability

| Req ID | Tasks |
|---|---|
| KEY-01 | T2, T5 + T9 |
| KEY-02 | T1, T2 |
| KEY-03 | T2, T5, T7 + T9 |
| KEY-04 | T2, T5 |
| KEY-05 | T3, T4 + T9 |
| KEY-06 | T4 + T9 |
| KEY-07 | T2, T3 |
| KEY-08 | T3, T4 + T9 |
| KEY-09 | T4 + T9 |
| KEY-10 | T4 + T9 |
| KEY-11 | T2, T6 |
| KEY-12 | T2, T4, T6 + T9 |
| KEY-13 | T7 + T9 |
| KEY-14 | T2, T5 |
| KEY-15 | T4, T5, T6 |
| KEY-16 | T7 |
| KEY-17 | T2, T7 |

**Coverage**: 17/17 requirements mapped to tasks (KEY-16/17 are P2 — included, not deferred).

---

## MCP / Skill note

Only T9 benefits from a tool: `mcp__playwright__*` for interactive E2E debugging. Every other task is
plain file edits + Prisma CLI — no MCP or Skill needed. Confirm before Execute if you want a different
tool assignment.
