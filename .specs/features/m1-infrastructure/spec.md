# M1 — Infrastructure Specification

## Problem Statement

The project needs a working foundation before any feature can be built or validated. This spec covers everything required to have a runnable local environment, a connected database, and a deployable app on Vercel — with an end-to-end roundtrip proving the stack is wired correctly.

## Goals

- [ ] Local dev environment runs with a single command (`docker compose up`)
- [ ] Prisma schema defined and migrations applied against local Postgres
- [ ] App deploys successfully to Vercel connected to the managed Postgres instance
- [ ] Authenticated API roundtrip (`GET /api/me`) proves NextAuth + Prisma + Postgres are operational

## Out of Scope

| Feature | Reason |
|---|---|
| Any application feature (editor, diagrams, listing) | Blocked on auth — belongs to later milestones |
| CI/CD pipeline beyond Vercel deploy | Out of v1 scope |
| Database backups / disaster recovery | Operational concern, post-MVP |

---

## User Stories

### P1: Local dev environment with Docker ⭐ MVP

**User Story**: As a developer, I want to run the full stack locally with a single command so that I can develop and test without manual DB setup.

**Why P1**: Nothing can be built or tested without a running local environment.

**Acceptance Criteria**:

1. WHEN developer runs `docker compose up` THEN a Postgres instance SHALL start on a defined local port
2. WHEN Postgres is running THEN Prisma migrations SHALL apply cleanly with `prisma migrate dev`
3. WHEN the app starts locally THEN it SHALL connect to the Dockerized Postgres via `DATABASE_URL`

**Independent Test**: Fresh clone → `docker compose up` → `prisma migrate dev` → app starts without errors.

---

### P1: Prisma schema — User and Diagram models ⭐ MVP

**User Story**: As a developer, I want the core data models defined and migrated so that subsequent features can persist data immediately.

**Why P1**: Auth and all diagram features depend on these models existing.

**Acceptance Criteria**:

1. WHEN migrations run THEN `User` table SHALL exist with fields: `id`, `email`, `name`, `createdAt`
2. WHEN migrations run THEN `Diagram` table SHALL exist with fields: `id`, `userId`, `name`, `data` (JSON), `createdAt`, `updatedAt`
3. WHEN a `Diagram` is created THEN `userId` SHALL reference a valid `User` (foreign key enforced)

**Independent Test**: Run migrations → inspect DB schema via Prisma Studio or psql — both tables present with correct columns.

---

### P1: Environment configuration ⭐ MVP

**User Story**: As a developer, I want environment variables cleanly separated between local and production so that secrets never leak and switching contexts is explicit.

**Why P1**: Required for both local dev and Vercel deploy to work correctly.

**Acceptance Criteria**:

1. WHEN running locally THEN app SHALL load config from `.env.local` (gitignored)
2. WHEN deployed to Vercel THEN app SHALL load config from Vercel environment variables
3. WHEN `.env.example` exists THEN it SHALL document all required variables without values

**Independent Test**: `.env.example` present in repo → `.env.local` gitignored → Vercel deploy uses its own env vars.

---

### P1: Vercel deployment pipeline ⭐ MVP

**User Story**: As a developer, I want the app to deploy to Vercel from the main branch so that the production URL is always current.

**Why P1**: MVP requires a live URL; deployment must be validated before features are built on top.

**Acceptance Criteria**:

1. WHEN code is pushed to `main` THEN Vercel SHALL trigger a new deployment automatically
2. WHEN deployment completes THEN the app SHALL be accessible at the Vercel URL
3. WHEN the app loads on Vercel THEN it SHALL connect to the managed Postgres instance without errors

**Independent Test**: Push to `main` → Vercel dashboard shows successful deploy → app URL loads.

---

### P1: Foundation validation — authenticated roundtrip ⭐ MVP

**User Story**: As a developer, I want a protected API route (`GET /api/me`) that returns the current user so that NextAuth, Prisma, and Postgres are confirmed operational end-to-end.

**Why P1**: Without this, infrastructure problems may be hidden until later features fail.

**Acceptance Criteria**:

1. WHEN an unauthenticated request hits `GET /api/me` THEN system SHALL return `401 Unauthorized`
2. WHEN an authenticated request hits `GET /api/me` THEN system SHALL return the current user's `id`, `email`, and `name` from the database
3. WHEN the endpoint responds successfully THEN it confirms NextAuth session, Prisma query, and Postgres connection are all working

**Independent Test**: Sign in → call `GET /api/me` in browser or curl → user object returned from DB.

---

## Edge Cases

- WHEN `DATABASE_URL` is missing or malformed THEN app SHALL fail fast with a clear error message on startup
- WHEN Docker Postgres port conflicts with a local Postgres THEN `docker-compose.yml` SHALL use a non-default port (e.g., 5433)
- WHEN Prisma migration fails THEN it SHALL not leave the database in a partial state

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| INFRA-01 | P1: Local dev with Docker | Design | Pending |
| INFRA-02 | P1: Prisma schema — User model | Design | Pending |
| INFRA-03 | P1: Prisma schema — Diagram model | Design | Pending |
| INFRA-04 | P1: Environment configuration | Design | Pending |
| INFRA-05 | P1: Vercel deployment | Design | Pending |
| INFRA-06 | P1: Foundation validation (GET /api/me) | Design | Pending |

---

## Success Criteria

- [ ] `docker compose up` + `prisma migrate dev` runs without errors on a fresh clone
- [ ] App deploys to Vercel and connects to managed Postgres
- [ ] `GET /api/me` returns the authenticated user from the database
- [ ] `.env.example` documents all required variables
