# M1 — Authentication Tasks

**Design**: `.specs/features/m1-auth/design.md`
**Status**: In Progress — Phase 2 complete (code); integration tests pending infra

**Cross-feature dependency**: All tasks here depend on m1-infrastructure T1–T4 being complete (Docker running, Prisma schema migrated, `lib/db.ts` available).

---

## Execution Plan

### Phase 1: Core Auth Config (Sequential)

Type declarations must exist before NextAuth config. NextAuth config must exist before helpers.

```
T1 → T2 → T3
```

### Phase 2: Route Protection + API Handlers (Sequential)

All depend on T2 (auth.ts). Integration tests are not parallel-safe — must run sequentially.

```
T3 → T4 → T5 → T6
```

### Phase 3: UI Pages (Parallel OK — unit tests only)

All depend on T2. Unit tests are parallel-safe.

```
T6 ──┬── T7 [P]
     ├── T8 [P]
     ├── T9 [P]
     └── T10 [P]
```

### Phase 4: E2E (Sequential)

Requires all previous phases complete and app running.

```
T7, T8, T9, T10 → T11
```

---

## Task Breakdown

### T1: Create types/next-auth.d.ts (session type augmentation)

**What**: Extend NextAuth's `Session` and `JWT` types to include `user.id` — makes `session.user.id` type-safe everywhere
**Where**: `types/next-auth.d.ts`
**Depends on**: m1-infra T3 (Prisma schema defines `User.id` as `String`)
**Reuses**: Nothing
**Requirement**: AUTH-05

**Done when**:

- [x] `Session` interface augmented with `user.id: string`
- [x] `JWT` interface augmented with `id: string`
- [x] Uses `DefaultSession["user"]` intersection — no fields duplicated
- [x] `tsconfig.json` includes `types/` in compilation (via `**/*.ts` glob)
- [ ] TypeScript reports no errors on `session.user.id` access in server code
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: none (type declaration only)
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T2: Create auth.ts (NextAuth Credentials config)

**What**: NextAuth v5 config with Credentials provider, JWT strategy, and `jwt`/`session` callbacks that embed and expose `userId`
**Where**: `auth.ts` (project root)
**Depends on**: T1 (type augmentation), m1-infra T4 (`lib/db.ts` available)
**Reuses**: `lib/db.ts`
**Requirement**: AUTH-01, AUTH-02, AUTH-05

**Done when**:

- [x] `auth.ts` exports `{ auth, signIn, signOut, handlers }` (NextAuth v5 API)
- [x] Credentials provider accepts `email` and `password`
- [x] `authorize()` finds user by email, runs `bcrypt.compare`, returns `null` on failure (never throws)
- [x] `jwt` callback: on sign-in, sets `token.id = user.id`
- [x] `session` callback: sets `session.user.id = token.id`
- [x] Strategy is `jwt` (no database adapter)
- [ ] TypeScript reports no errors (blocked: awaiting lib/db.ts from infra T4)
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: none (config file — tested indirectly via T5 integration tests)
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T3: Create lib/auth.ts (server session helpers)

**What**: Typed wrappers around NextAuth's `auth()` — single import point for all server-side session access
**Where**: `lib/auth.ts`
**Depends on**: T2 (auth.ts must exist and export `auth`)
**Reuses**: `auth.ts`
**Requirement**: AUTH-03, AUTH-05

**Done when**:

- [x] `getSession()` wraps `auth()` and returns `Session | null`
- [x] `requireSession()` calls `getSession()` — returns `Session` or throws `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`
- [x] Return types use the augmented `Session` from `types/next-auth.d.ts`
- [ ] No direct calls to `auth()` exist outside this file in application code
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: none (tested indirectly via API route integration tests in T5, T6)
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T4: Create middleware.ts (route protection)

**What**: Next.js middleware that protects all app routes using NextAuth's `auth`, with an explicit matcher that excludes static assets and NextAuth's own routes
**Where**: `middleware.ts` (project root)
**Depends on**: T2 (auth.ts exports `auth`)
**Reuses**: `auth.ts`
**Requirement**: AUTH-03

**Done when**:

- [x] Re-exports `auth as middleware` from `auth.ts`
- [x] `config.matcher` uses regex that excludes: `_next/static`, `_next/image`, `favicon.ico`, `api/auth`, and common image extensions
- [ ] Unauthenticated request to `/` is redirected to `/sign-in`
- [ ] Request to `/api/auth/signin` passes through without redirect loop
- [ ] Request to `/_next/static/**` is NOT intercepted by auth middleware
- [ ] Integration test covers: unauthenticated → redirect, static path → no redirect
- [ ] Gate check passes: `npm run lint && npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full — `npm run lint && npm run test:unit && npm run test:integration`

---

### T5: Create app/api/auth/[...nextauth]/route.ts

**What**: NextAuth route handler — exposes GET and POST handlers for all NextAuth endpoints (`/api/auth/signin`, `/api/auth/signout`, `/api/auth/session`, etc.)
**Where**: `app/api/auth/[...nextauth]/route.ts`
**Depends on**: T2 (auth.ts `handlers` export), T4 (middleware excludes this path)
**Reuses**: `auth.ts`
**Requirement**: AUTH-01, AUTH-02, AUTH-04

**Done when**:

- [x] File exports `{ GET, POST }` from `auth.handlers`
- [ ] `POST /api/auth/signin` with valid credentials creates a session cookie
- [ ] `POST /api/auth/signin` with invalid credentials returns error (no 500)
- [ ] `POST /api/auth/signout` destroys the session
- [ ] Integration test covers: valid sign-in → session cookie set; invalid sign-in → no session; sign-out → session gone
- [ ] Gate check passes: `npm run lint && npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full — `npm run lint && npm run test:unit && npm run test:integration`

---

### T6: Create app/api/auth/register/route.ts

**What**: Custom registration endpoint — validates input, hashes password, creates User in DB
**Where**: `app/api/auth/register/route.ts`
**Depends on**: T3 (lib/auth.ts), m1-infra T4 (`lib/db.ts`)
**Reuses**: `lib/db.ts`
**Requirement**: AUTH-01

**Done when**:

- [x] `POST /api/auth/register` with valid `{ email, name?, password }` creates User and returns `201 { id, email }`
- [x] Zod validates: email format, password minimum 8 characters
- [x] Returns `400` with field errors when Zod validation fails
- [x] Returns `409` when email already exists (message: "An account with this email already exists")
- [x] Password stored as bcrypt hash (cost 12) — never plaintext
- [x] `userId` is never accepted from request body (only generated by DB)
- [ ] Integration test covers: success → 201 + user in DB; duplicate email → 409; short password → 400
- [ ] Gate check passes: `npm run lint && npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full — `npm run lint && npm run test:unit && npm run test:integration`

---

### T7: Create app/(auth)/layout.tsx [P]

**What**: Minimal layout for unauthenticated pages (sign-in, sign-up) — centered, dark background, no app chrome
**Where**: `app/(auth)/layout.tsx`
**Depends on**: T2 (auth.ts available — layout may redirect authenticated users)
**Reuses**: Nothing
**Requirement**: AUTH-01, AUTH-02

**Done when**:

- [ ] Layout renders `children` centered on a dark background (aligned with DESIGN.md)
- [ ] Authenticated users visiting `(auth)` routes are redirected to `/`
- [ ] No app navigation or chrome rendered
- [ ] Unit test: renders children correctly; applies correct layout structure
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T8: Create app/(auth)/sign-in/page.tsx [P]

**What**: Sign-in page with email + password form that calls NextAuth `signIn('credentials', ...)`
**Where**: `app/(auth)/sign-in/page.tsx`
**Depends on**: T2 (NextAuth `signIn` available), T7 (layout exists)
**Reuses**: `(auth)/layout.tsx`
**Requirement**: AUTH-02

**Done when**:

- [ ] Form has email and password fields with labels
- [ ] Submit calls `signIn('credentials', { email, password, redirectTo: '/' })`
- [ ] On `CredentialsSignin` error: displays "Invalid email or password" (no enumeration)
- [ ] Empty field submission shows client-side validation before calling signIn
- [ ] Link to sign-up page present
- [ ] Unit test: renders form; shows error on failed sign-in; redirects on success (mock signIn)
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T9: Create app/(auth)/sign-up/page.tsx [P]

**What**: Sign-up page with name (optional), email, password form that calls the register API then signs in
**Where**: `app/(auth)/sign-up/page.tsx`
**Depends on**: T6 (register route exists), T7 (layout exists)
**Reuses**: `(auth)/layout.tsx`
**Requirement**: AUTH-01

**Done when**:

- [ ] Form has name (optional), email, and password fields
- [ ] Submit calls `POST /api/auth/register`; on `201` immediately calls `signIn('credentials', ...)`
- [ ] On `409`: displays "An account with this email already exists"
- [ ] On `400`: displays field-level validation errors from Zod response
- [ ] Link to sign-in page present
- [ ] Unit test: renders form; shows 409 error; shows 400 field errors; calls signIn on success
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T10: Create app/(app)/page.tsx placeholder [P]

**What**: Placeholder page for the Diagram Index — confirms protected routes work and authenticated users land somewhere after sign-in
**Where**: `app/(app)/page.tsx`
**Depends on**: T4 (middleware protects this route), T7 (establishes route group pattern)
**Reuses**: Nothing
**Requirement**: AUTH-03

**Done when**:

- [ ] Page renders a visible placeholder (e.g., "Diagram Index — coming soon")
- [ ] Accessible only when authenticated (middleware redirects otherwise)
- [ ] Unauthenticated navigation to `/` redirects to `/sign-in`
- [ ] Unit test: renders placeholder text
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick — `npm run lint && npm run test:unit`

---

### T11: Create Playwright E2E tests for auth flows

**What**: E2E tests covering the critical auth journeys: sign-up → land on index; sign-in → land on index; sign-out → redirect to sign-in; unauthenticated access → redirect
**Where**: `tests/e2e/auth.spec.ts`
**Depends on**: T7, T8, T9, T10 (all UI complete), m1-infra T6 (Playwright config)
**Reuses**: `playwright.config.ts`
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04

**Done when**:

- [ ] Test: new user signs up → lands on Diagram Index placeholder
- [ ] Test: existing user signs in → lands on Diagram Index placeholder
- [ ] Test: signed-in user signs out → redirected to sign-in page
- [ ] Test: unauthenticated user navigates to `/` → redirected to `/sign-in`
- [ ] Test: already-authenticated user visits `/sign-in` → redirected to `/`
- [ ] Tests use isolated user data per run (factory or unique email per test)
- [ ] Gate check passes: `npm run test:e2e`

**Tests**: E2E
**Gate**: full — `npm run lint && npm run test:unit && npm run test:integration && npm run test:e2e`

---

## Parallel Execution Map

```
Phase 1 (Sequential — core config):
  [infra T1-T4 done]
  T1 ──→ T2 ──→ T3

Phase 2 (Sequential — route protection + API, integration tests):
  T3 ──→ T4 ──→ T5 ──→ T6

Phase 3 (Parallel — UI pages, unit tests only):
  T6 complete, then:
    ├── T7 [P]
    ├── T8 [P]   } All unit tests, parallel-safe
    ├── T9 [P]
    └── T10 [P]

Phase 4 (Sequential — E2E):
  T7 + T8 + T9 + T10 complete, then:
    T11
```

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: types/next-auth.d.ts | 1 type declaration file | ✅ Granular |
| T2: auth.ts | 1 config file | ✅ Granular |
| T3: lib/auth.ts | 1 utility file, 2 functions | ✅ Granular |
| T4: middleware.ts | 1 middleware file | ✅ Granular |
| T5: [...nextauth]/route.ts | 1 route handler | ✅ Granular |
| T6: register/route.ts | 1 API route | ✅ Granular |
| T7: (auth)/layout.tsx | 1 layout component | ✅ Granular |
| T8: sign-in/page.tsx | 1 page component | ✅ Granular |
| T9: sign-up/page.tsx | 1 page component | ✅ Granular |
| T10: (app)/page.tsx | 1 placeholder page | ✅ Granular |
| T11: auth.spec.ts | 1 E2E test file | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | infra T3 | infra done → T1 | ✅ Match |
| T2 | T1, infra T4 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T2 | T3 → T4 | ✅ Match |
| T5 | T2, T4 | T4 → T5 | ✅ Match |
| T6 | T3, infra T4 | T5 → T6 | ✅ Match |
| T7 | T2 | T6 → T7 [P] | ✅ Match |
| T8 | T2, T7 | T6 → T8 [P] | ✅ Match |
| T9 | T6, T7 | T6 → T9 [P] | ✅ Match |
| T10 | T4, T7 | T6 → T10 [P] | ✅ Match |
| T11 | T7, T8, T9, T10, infra T6 | T7+T8+T9+T10 → T11 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Type declaration | none | none | ✅ OK |
| T2 | Auth config (`auth.ts`) | integration (auth flows) | none — tested via T5 | ✅ OK (config, no testable behavior alone) |
| T3 | `lib/auth.ts` | integration (per Q4 answer) | none — tested via T5, T6 | ✅ OK (wrapper, no standalone behavior) |
| T4 | Middleware | integration + E2E | integration | ✅ OK |
| T5 | API route (`app/api/**`) | integration | integration | ✅ OK |
| T6 | API route (`app/api/**`) | integration | integration | ✅ OK |
| T7 | React component | unit | unit | ✅ OK |
| T8 | React component | unit + E2E | unit (E2E in T11) | ✅ OK |
| T9 | React component | unit + E2E | unit (E2E in T11) | ✅ OK |
| T10 | React component | unit | unit | ✅ OK |
| T11 | E2E test file | E2E | E2E | ✅ OK |
