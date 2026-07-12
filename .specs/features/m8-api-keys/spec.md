# Machine Auth (API Keys) Specification

## Problem Statement

Every Schemr API route today authenticates through a NextAuth browser session (JWT cookie). That
works for a human in a browser, but the upcoming AI Diagram MCP (M10) runs headless — no cookie, no
sign-in flow. There is currently no way for a non-browser client to prove "I am acting as user X".
Machine auth via long-lived, revocable API keys closes that gap and is the hard prerequisite for
every later phase (M9 generation endpoint, M10 MCP server).

## Goals

- [ ] A signed-in user can mint an API key, see the raw secret exactly once, and copy it.
- [ ] A request carrying `Authorization: Bearer <key>` authenticates against the existing diagram
      API as the key's owner, with ownership rules unchanged (a key reaches only its owner's data).
- [ ] Keys are stored only as a hash — the raw secret is never persisted and never retrievable after creation.
- [ ] The owner can revoke a key at any time; a revoked key fails auth immediately (401).
- [ ] Existing browser-session auth on all routes keeps working with zero regression.

## Out of Scope

| Feature | Reason |
|---|---|
| OAuth / device-code / PKCE flows | API keys are enough for headless MCP clients in this phase |
| Per-route / granular scope enforcement | A single `diagrams` scope is stored but not differentiated; finer scopes are a later concern |
| Rate limiting per key | Belongs to M12 (Polish & Hardening) |
| Key expiry / automatic rotation policies | Manual revoke covers v1; TTL deferred |
| Org / team / shared keys | Keys are strictly per-user in this phase |
| Minting or revoking keys **with** an API key | Key management is session-only — a key cannot escalate to create more keys |
| Bearer auth on non-diagram routes (folders, tags) | M8 wires bearer only into the diagram API the MCP needs; other routes stay session-only |

---

## User Stories

### P1: Mint an API key ⭐ MVP

**User Story**: As a signed-in user, I want to generate an API key so that a headless client (the MCP server) can act on my behalf.

**Why P1**: Without a key there is nothing to authenticate with — the whole epic is blocked.

**Acceptance Criteria**:

1. WHEN the owner creates a key with an optional label THEN system SHALL generate a CSPRNG secret (≥ 256 bits) prefixed `sk_`, persist only its hash, and return the raw secret in the response body.
2. WHEN a key has been created THEN system SHALL display the raw secret exactly once with a copy action and a warning that it cannot be shown again.
3. WHEN the owner creates a key THEN system SHALL associate it with the current session user (userId from session, never from client input).
4. WHEN the raw secret has been shown once and the view is dismissed or reloaded THEN system SHALL NOT expose the raw secret again through any endpoint.

**Independent Test**: Sign in → open API-keys settings → create key → raw `sk_…` secret shown once with a copy button → reload → only masked metadata remains.

---

### P1: Authenticate diagram API requests with a key ⭐ MVP

**User Story**: As a headless client, I want to call the diagram API with a bearer key so that I can create and read diagrams without a browser session.

**Why P1**: This is the capability M9/M10 build on — a key that can't authenticate is useless.

**Acceptance Criteria**:

1. WHEN a request to a diagram API route carries `Authorization: Bearer <valid-key>` THEN system SHALL resolve the owning userId and process the request as that user.
2. WHEN a bearer-authenticated request accesses diagrams THEN system SHALL apply the exact same ownership scoping as session requests (the key reaches only its owner's diagrams).
3. WHEN a bearer-authenticated request succeeds THEN system SHALL update the key's `lastUsedAt`.
4. WHEN a request carries a malformed, unknown, or revoked bearer key THEN system SHALL return `401` JSON (never a redirect to sign-in, never fall through to session auth).
5. WHEN a bearer-carrying request hits the auth middleware THEN system SHALL allow it through to the route handler instead of redirecting to `/sign-in`.
6. WHEN an existing browser-session request hits any route THEN system SHALL behave exactly as before (no regression).

**Independent Test**: `curl -H "Authorization: Bearer sk_…" /api/diagrams` returns the owner's diagrams (200); same curl with a garbage key returns 401 JSON.

---

### P1: Revoke a key ⭐ MVP

**User Story**: As a key owner, I want to revoke a key so that a leaked or unused secret stops working.

**Why P1**: A credential with no off-switch is a security liability users won't trust.

**Acceptance Criteria**:

1. WHEN the owner revokes a key THEN system SHALL set its `revokedAt`, scoped to the owner (a user cannot revoke another user's key).
2. WHEN a key has been revoked THEN system SHALL cause every subsequent bearer request using it to return `401`.
3. WHEN the owner revokes a key THEN system SHALL require a confirmation step in the UI before revoking.
4. WHEN a revoked key exists THEN system SHALL keep showing it in the list marked "revoked" (audit trail), not silently delete it.

**Independent Test**: Create key, use it (200), revoke it, use it again → 401; list still shows the key flagged revoked.

---

### P1: List keys (metadata only) ⭐ MVP

**User Story**: As a key owner, I want to see my keys so that I know what exists and can manage them.

**Why P1**: Users need to see and revoke keys; a mint-only flow is unmanageable.

**Acceptance Criteria**:

1. WHEN the owner lists keys THEN system SHALL return only metadata: id, label, masked prefix, scopes, `lastUsedAt`, `createdAt`, and revoked state.
2. WHEN keys are listed THEN system SHALL NEVER include the raw secret or the stored hash in the response.
3. WHEN the owner lists keys THEN system SHALL return only keys owned by the session user.

**Independent Test**: Inspect `GET /api/api-keys` network response — no `hashedKey`, no raw secret; only masked metadata for the current user.

---

### P2: Key metadata display

**User Story**: As a key owner, I want to see each key's label, prefix, last-used time and status so that I can tell keys apart and spot stale ones.

**Why P2**: Improves manageability; the P1 list already returns the data, this is presentation polish.

**Acceptance Criteria**:

1. WHEN a key is shown in the list THEN system SHALL display its label, masked prefix (e.g. `sk_a1b2c3…`), `lastUsedAt` (or "never used"), and a revoked badge when applicable.
2. WHEN a key has never been used THEN system SHALL show "never used" rather than an empty value.

**Independent Test**: List renders label + `sk_…` prefix + last-used text; a revoked key shows a badge.

---

## Edge Cases

- WHEN two generated keys hash-collide (astronomically unlikely) THEN system SHALL fail the create with a retryable error rather than overwrite (unique constraint on `hashedKey`).
- WHEN the `Authorization` header is present but not `Bearer ` scheme THEN system SHALL treat the request as unauthenticated (fall through to session for browser requests; 401 for API-only).
- WHEN a `Bearer` header is present but empty/whitespace THEN system SHALL return 401 (not fall through to session).
- WHEN a bearer key is used against a key-management route (`/api/api-keys*`) THEN system SHALL reject it (401) — key management is session-only, no privilege escalation.
- WHEN a revoked key's owner is deleted THEN system SHALL cascade-delete the key with the user (FK `onDelete: Cascade`).
- WHEN a bearer request targets a diagram owned by another user THEN system SHALL return 403/404 exactly as a session request would (no ownership bypass).
- WHEN `lastUsedAt` update fails mid-request THEN system SHALL still complete the authenticated request (usage tracking is best-effort, not a gate).

---

## Data Model

```
ApiKey (new model)
  id         String    @id @default(cuid())
  userId     String                          // owner
  label      String    @default("API key")
  hashedKey  String    @unique               // sha-256 hex of the raw secret; the ONLY stored form
  prefix     String                          // first chars of the raw secret, for display only (e.g. "sk_a1b2c3d")
  scopes     String[]  @default(["diagrams"])
  lastUsedAt DateTime?
  revokedAt  DateTime?                        // null = active; set = revoked (row retained for audit)
  createdAt  DateTime  @default(now())
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])

User (additive)
  ...existing fields...
  apiKeys    ApiKey[]
```

Rationale: the raw secret is never stored — only its sha-256 hash, which is uniquely indexed so
auth is a single O(1) lookup. `prefix` gives users a human-readable handle without exposing the
secret. `revokedAt` as a nullable timestamp (not a boolean) both flags revocation and records when.

New / changed API surface:

- `GET    /api/api-keys`        — session-only; lists the caller's keys (metadata only).
- `POST   /api/api-keys`        — session-only; mints a key, returns `{ id, key: "<raw, shown once>", prefix, label }`.
- `DELETE /api/api-keys/:id`    — session-only; revokes an owned key (sets `revokedAt`), returns 204.
- Existing `/api/diagrams` and `/api/diagrams/:id` (all methods) — now accept **either** session **or** bearer key, resolved to a single `userId`.
- `auth.config.ts` `authorized` callback — lets bearer-carrying `/api/*` requests through to their handler.

New page:

- `/settings/api-keys` — authenticated settings page rendering the key manager (create / list / reveal-once / revoke).

---

## Security Notes

- Raw key = `sk_` + base64url(`crypto.randomBytes(32)`) → ≥ 256 bits entropy; unguessable, unenumerable.
- Only the sha-256 hash of the full raw key is stored. A fast hash (not bcrypt) is correct here: the
  input is already high-entropy random, and a hashed-column unique index enables O(1) lookup — bcrypt
  would force a full-table scan since you cannot index a per-row salt. See design Tech Decisions.
- The raw secret is returned **only** in the create response and never again by any endpoint.
- List / read endpoints MUST select only metadata columns — never `hashedKey`.
- Key-management routes (`/api/api-keys*`) MUST use session auth only. A bearer key MUST NOT be able
  to mint or revoke keys (prevents a leaked key from self-propagating).
- Invalid bearer keys MUST return 401 and MUST NOT silently fall through to session auth (avoids
  confusing/ambiguous auth state).
- Ownership on diagram routes MUST continue to derive `userId` from the resolved actor, never from
  client input — identical guarantee to the existing session flow.
- The middleware allowance MUST be gated so it only lets requests through to a handler that itself
  re-validates the key; passing the middleware grants no access on its own.

---

## Requirement Traceability

| Requirement ID | Story | Status |
|---|---|---|
| KEY-01 | P1: Create mints CSPRNG `sk_` secret, stores hash, returns raw | Pending |
| KEY-02 | P1: Raw secret persisted only as sha-256 hash, never plaintext | Pending |
| KEY-03 | P1: Raw secret returned exactly once (create), never retrievable again | Pending |
| KEY-04 | P1: Create is owner-scoped (userId from session) | Pending |
| KEY-05 | P1: Bearer key resolves to owning userId; request acts as that user | Pending |
| KEY-06 | P1: Bearer request keeps identical ownership scoping | Pending |
| KEY-07 | P1: `lastUsedAt` updated on successful bearer auth (best-effort) | Pending |
| KEY-08 | P1: Malformed/unknown/revoked/empty bearer → 401 JSON, no session fallthrough | Pending |
| KEY-09 | P1: Middleware lets bearer `/api/*` requests reach handler (no sign-in redirect) | Pending |
| KEY-10 | P1: Session auth on existing routes unchanged (no regression) | Pending |
| KEY-11 | P1: Revoke sets `revokedAt`, owner-scoped | Pending |
| KEY-12 | P1: Revoked key → 401 on every subsequent request | Pending |
| KEY-13 | P1: Revoke requires UI confirmation | Pending |
| KEY-14 | P1: List returns metadata only (no hash, no raw), owner-scoped | Pending |
| KEY-15 | P1: Key-management routes reject bearer keys (session-only) | Pending |
| KEY-16 | P2: List displays label, masked prefix, lastUsedAt/"never used", revoked badge | Pending |
| KEY-17 | P2: Revoked keys retained in list (audit), not deleted | Pending |

**Coverage:** 17 total, 0 mapped to tasks, 17 unmapped ⚠️ (mapped in tasks.md)

---

## Success Criteria

- [ ] `curl -H "Authorization: Bearer sk_…" $ORIGIN/api/diagrams` returns the owner's diagrams; a bad key returns 401 JSON.
- [ ] Inspecting the DB shows only a hash + prefix for each key — no raw secret anywhere.
- [ ] Create response is the only place the raw secret appears; it never reappears on list/reload.
- [ ] Revoking a key makes the same curl fail with 401 within one request.
- [ ] All pre-existing session-authenticated flows and tests still pass (zero regression).
- [ ] Raw key entropy ≥ 256 bits from a CSPRNG.
