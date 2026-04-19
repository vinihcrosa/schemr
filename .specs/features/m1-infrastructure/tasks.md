# M1 — Infrastructure Tasks

**Design**: `.specs/features/m1-infrastructure/design.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Local Environment (Sequential)

Must complete before anything else. No parallelism possible — each step depends on the previous.

```
T1 → T2 → T3 → T4
```

### Phase 2: App Wiring (Parallel OK)

T4 complete. T5 and T6 have no shared state — can run simultaneously.

```
T4 ──┬── T5 [P]
     └── T6 [P]
```

### Phase 3: Test Infrastructure (Sequential)

Depends on T4 (schema migrated) and T6 (Vitest config exists).

```
T5, T6 → T7
```

### Phase 4: Validation (Sequential, cross-feature dependency)

T8 depends on T4, T5, and **m1-auth being fully complete**.
T9 depends on T8.

```
[m1-auth done] + T5 → T8 → T9
```

---

## Task Breakdown

### T1: Create docker-compose.yml

**What**: Docker Compose file that starts a Postgres 16 instance for local development
**Where**: `docker-compose.yml` (project root)
**Depends on**: None
**Reuses**: Nothing
**Requirement**: INFRA-01

**Done when**:

- [ ] `docker compose up -d` starts Postgres on port `5433` without errors
- [ ] Container uses `postgres:16-alpine` image
- [ ] Credentials (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) loaded from env
- [ ] Named volume defined for data persistence between restarts
- [ ] `docker compose down` stops the container cleanly

**Tests**: none
**Gate**: manual — `docker compose up -d && docker compose ps`

---

### T2: Create .env.example and .env.local

**What**: Document all required environment variables and configure local values
**Where**: `.env.example` (committed), `.env.local` (gitignored)
**Depends on**: T1 (to know Docker port and credentials)
**Reuses**: Nothing
**Requirement**: INFRA-04

**Done when**:

- [ ] `.env.example` lists all required variables with no values: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- [ ] `.env.local` has working values pointing to Docker Postgres on port `5433`
- [ ] `.env.local` is listed in `.gitignore`
- [ ] `.env.example` is committed to the repo

**Tests**: none
**Gate**: manual — verify `.gitignore` excludes `.env.local`

---

### T3: Define Prisma schema and run first migration

**What**: Prisma schema with `User` and `Diagram` models, and first migration applied
**Where**: `prisma/schema.prisma`, `prisma/migrations/`
**Depends on**: T1 (Docker running), T2 (DATABASE_URL set)
**Reuses**: Data models from design doc
**Requirement**: INFRA-02, INFRA-03

**Done when**:

- [ ] `prisma/schema.prisma` defines `User` model: `id`, `email` (unique), `name?`, `password`, `diagrams`, `createdAt`
- [ ] `prisma/schema.prisma` defines `Diagram` model: `id`, `name` (default "Untitled"), `data` (Json), `userId`, `user` (relation, onDelete: Cascade), `createdAt`, `updatedAt`
- [ ] `npx prisma migrate dev --name init` completes without errors
- [ ] Both tables exist in the local DB (verify via `npx prisma studio` or psql)
- [ ] `prisma/migrations/` directory committed to repo

**Tests**: none
**Gate**: manual — `npx prisma migrate dev` exits 0

---

### T4: Create lib/db.ts Prisma client singleton

**What**: Single shared Prisma client instance using `globalThis` pattern to prevent hot-reload connection exhaustion
**Where**: `lib/db.ts`
**Depends on**: T3 (Prisma client generated after migration)
**Reuses**: Nothing — standard Next.js + Prisma singleton pattern
**Requirement**: INFRA-01

**Done when**:

- [ ] `lib/db.ts` exports `const db: PrismaClient`
- [ ] Uses `globalThis.__prisma` to reuse existing instance in dev
- [ ] TypeScript reports no errors on `import { db } from '@/lib/db'`
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T5: Create vitest.config.ts with unit and integration projects [P]

**What**: Single Vitest config with two projects: `unit` (fast, no DB) and `integration` (with test DB)
**Where**: `vitest.config.ts` (project root)
**Depends on**: T4
**Reuses**: Nothing
**Requirement**: INFRA-01 (test infrastructure)

**Done when**:

- [ ] `vitest.config.ts` defines `project: unit` — matches `**/*.unit.test.ts`, no globalSetup, fast env
- [ ] `vitest.config.ts` defines `project: integration` — matches `**/*.integration.test.ts`, uses `globalSetup`, restricted parallelism (`singleFork` or `maxConcurrency: 1`)
- [ ] `package.json` scripts: `"test:unit": "vitest --project unit"`, `"test:integration": "vitest --project integration"`, `"test": "vitest"`
- [ ] `npm run test:unit` runs (passes or no tests found — not errors) 
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: none
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T6: Create Playwright config [P]

**What**: Playwright configuration targeting production build (`next build && next start`)
**Where**: `playwright.config.ts` (project root)
**Depends on**: T4
**Reuses**: Nothing
**Requirement**: INFRA-01 (test infrastructure)

**Done when**:

- [ ] `playwright.config.ts` defines `webServer` using `next build && next start` command
- [ ] Uses `TEST_DATABASE_URL` env var (separate test DB) when starting the app for E2E
- [ ] `package.json` script: `"test:e2e": "playwright test"`
- [ ] `npx playwright install` documented in project README or setup instructions
- [ ] `npm run test:e2e` fails gracefully (no tests yet — not a config crash)

**Tests**: none
**Gate**: manual — `npm run test:e2e` exits without config errors

---

### T7: Create Vitest globalSetup for integration test database

**What**: `globalSetup` script that provisions the test database and runs migrations before integration suites
**Where**: `tests/setup/integration-setup.ts`
**Depends on**: T3 (migrations exist), T5 (Vitest config references globalSetup)
**Reuses**: Nothing
**Requirement**: INFRA-01 (test infrastructure)

**Done when**:

- [ ] `integration-setup.ts` runs `prisma migrate deploy` against `TEST_DATABASE_URL` on test start
- [ ] `TEST_DATABASE_URL` points to `schemr_test` database (separate from `schemr_dev`)
- [ ] Setup resets or recreates the test schema on each full run
- [ ] `npm run test:integration` completes without DB connection errors (no integration tests yet — verifies setup only)
- [ ] Gate check passes: `npm run test:integration`

**Tests**: none (this IS the test infrastructure)
**Gate**: `npm run test:integration` — exits 0

---

### T8: Create GET /api/me route

**What**: Protected API route that returns the current authenticated user from the database
**Where**: `app/api/me/route.ts`
**Depends on**: T4 (lib/db.ts), **m1-auth fully complete** (session available)
**Reuses**: `lib/db.ts`, `lib/auth.ts` (from m1-auth)
**Requirement**: INFRA-06

**Done when**:

- [ ] `GET /api/me` returns `401` when no session exists
- [ ] `GET /api/me` returns `{ id, email, name }` for authenticated user (queried from DB, not just session)
- [ ] `userId` extracted from session — not from request params or body
- [ ] Integration test covers: unauthenticated → 401, authenticated → user object from DB
- [ ] Gate check passes: `npm run test:integration`

**Tests**: integration
**Gate**: full — `npm run lint && npm run test:unit && npm run test:integration`

---

### T9: Validate Vercel deployment

**What**: Confirm the app builds and runs on Vercel connected to the managed Postgres instance
**Where**: Vercel project settings + `vercel.json` if needed
**Depends on**: T8 (all local functionality verified)
**Reuses**: Nothing
**Requirement**: INFRA-05

**Done when**:

- [ ] Vercel project linked to the repo's `main` branch
- [ ] `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` set in Vercel environment variables
- [ ] Push to `main` triggers automatic deployment
- [ ] Deployment completes without build errors
- [ ] App loads at Vercel URL and `GET /api/me` returns 401 (confirms DB + auth are wired)

**Tests**: none
**Gate**: manual — Vercel dashboard shows successful deploy; URL responds

---

## Parallel Execution Map

```
Phase 1 (Sequential — local environment):
  T1 ──→ T2 ──→ T3 ──→ T4

Phase 2 (Parallel — after T4):
  T4 complete, then:
    ├── T5 [P]  (Vitest config)
    └── T6 [P]  (Playwright config)

Phase 3 (Sequential — test infrastructure):
  T5 + T6 complete, then:
    T7  (integration globalSetup)

Phase 4 (Sequential — validation, cross-feature):
  T7 + m1-auth complete, then:
    T8 ──→ T9
```

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: docker-compose.yml | 1 config file | ✅ Granular |
| T2: .env.example + .env.local | 2 env files, 1 concern | ✅ Granular |
| T3: Prisma schema + migration | 1 schema file + 1 command | ✅ Granular |
| T4: lib/db.ts | 1 utility file | ✅ Granular |
| T5: vitest.config.ts | 1 config file | ✅ Granular |
| T6: playwright.config.ts | 1 config file | ✅ Granular |
| T7: integration globalSetup | 1 setup file | ✅ Granular |
| T8: GET /api/me | 1 API route | ✅ Granular |
| T9: Vercel deploy | 1 deploy validation | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Start | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1, T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 [P] | ✅ Match |
| T6 | T4 | T4 → T6 [P] | ✅ Match |
| T7 | T3, T5 | T5+T6 → T7 | ✅ Match |
| T8 | T4, T7, m1-auth | m1-auth+T7 → T8 | ✅ Match |
| T9 | T8 | T8 → T9 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Config file | none | none | ✅ OK |
| T2 | Config file | none | none | ✅ OK |
| T3 | Prisma schema | none (schema only) | none | ✅ OK |
| T4 | `lib/db.ts` | unit | unit | ✅ OK |
| T5 | Config file | none | none | ✅ OK |
| T6 | Config file | none | none | ✅ OK |
| T7 | Test infrastructure | none | none | ✅ OK |
| T8 | API route (`app/api/**`) | integration | integration | ✅ OK |
| T9 | Deploy validation | none | none | ✅ OK |
