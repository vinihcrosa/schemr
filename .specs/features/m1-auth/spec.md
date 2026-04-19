# M1 — Authentication Specification

## Problem Statement

Schemr is a personal diagram workspace — every diagram belongs to a user. Without authentication, ownership cannot be enforced and user data cannot be isolated. Auth is the prerequisite for every other feature in the product.

## Goals

- [ ] Users can create an account and sign in
- [ ] Sessions are persisted and protected across page navigation
- [ ] All application routes are protected — unauthenticated users are redirected to sign in
- [ ] `userId` is always derived server-side from the session (never from client input)

## Out of Scope

| Feature | Reason |
|---|---|
| OAuth providers (Google, GitHub, etc.) | v1 ships email+password only; OAuth can be added later |
| Password reset / forgot password flow | Post-MVP; acceptable risk for a single-developer v1 |
| Email verification | Post-MVP |
| Role-based access control | Single role only (user) in v1 |
| Account deletion | Post-MVP |

---

## User Stories

### P1: Sign up with email and password ⭐ MVP

**User Story**: As a new user, I want to create an account with my email and password so that I can access my personal diagram workspace.

**Why P1**: No account = no access to the product.

**Acceptance Criteria**:

1. WHEN user submits a valid email and password THEN system SHALL create a new `User` record in the database
2. WHEN user submits an email already in use THEN system SHALL display an error: "An account with this email already exists"
3. WHEN user submits a password shorter than 8 characters THEN system SHALL reject it with a validation error
4. WHEN sign up succeeds THEN system SHALL start a session and redirect to the Diagram Index

**Independent Test**: Submit new credentials → user created in DB → redirected to Index.

---

### P1: Sign in with email and password ⭐ MVP

**User Story**: As a returning user, I want to sign in with my email and password so that I can access my diagrams.

**Why P1**: Core access flow — product is unusable without it.

**Acceptance Criteria**:

1. WHEN user submits valid credentials THEN system SHALL start a session and redirect to the Diagram Index
2. WHEN user submits incorrect credentials THEN system SHALL display a generic error: "Invalid email or password"
3. WHEN user submits an email that does not exist THEN system SHALL display the same generic error (no enumeration)
4. WHEN sign in succeeds THEN session SHALL persist across page reloads and navigation

**Independent Test**: Sign in → redirected to Index → refresh page → still authenticated.

---

### P1: Protected routes ⭐ MVP

**User Story**: As the system, I want all application routes to be protected so that unauthenticated users cannot access any diagram data.

**Why P1**: Without route protection, ownership enforcement is meaningless.

**Acceptance Criteria**:

1. WHEN an unauthenticated user navigates to any app route THEN system SHALL redirect to the sign in page
2. WHEN an authenticated user navigates to the sign in page THEN system SHALL redirect to the Diagram Index
3. WHEN a session expires THEN system SHALL redirect the user to the sign in page on next request

**Independent Test**: Clear session → navigate to `/` → redirected to sign in.

---

### P1: Sign out ⭐ MVP

**User Story**: As a signed-in user, I want to sign out so that my session is terminated.

**Why P1**: Basic session hygiene; required for shared devices.

**Acceptance Criteria**:

1. WHEN user triggers sign out THEN system SHALL destroy the current session
2. WHEN session is destroyed THEN system SHALL redirect to the sign in page
3. WHEN user navigates back after sign out THEN system SHALL not restore the previous session

**Independent Test**: Sign out → navigate to Index → redirected to sign in.

---

### P1: Server-side session validation ⭐ MVP

**User Story**: As the system, I want `userId` to always be derived from the server-side session so that client-provided identity cannot be trusted or spoofed.

**Why P1**: Fundamental security requirement — ownership of diagrams depends on this.

**Acceptance Criteria**:

1. WHEN any API route accesses user data THEN system SHALL extract `userId` from the server-side session only
2. WHEN a request includes a `userId` in the body or query params THEN system SHALL ignore it and use only the session value
3. WHEN no valid session exists on an API request THEN system SHALL return `401 Unauthorized`

**Independent Test**: Authenticated request to `GET /api/me` → returns session user, not any client-provided id.

---

## Edge Cases

- WHEN user submits sign in form with empty fields THEN system SHALL display field-level validation errors before submitting
- WHEN session token is tampered with THEN NextAuth SHALL invalidate it and return 401
- WHEN database is unreachable during sign in THEN system SHALL display a generic error without leaking DB details
- WHEN two concurrent sign-in attempts occur THEN system SHALL handle each independently without collision

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| AUTH-01 | P1: Sign up | Design | Pending |
| AUTH-02 | P1: Sign in | Design | Pending |
| AUTH-03 | P1: Protected routes | Design | Pending |
| AUTH-04 | P1: Sign out | Design | Pending |
| AUTH-05 | P1: Server-side session validation | Design | Pending |

---

## Success Criteria

- [ ] New user can create an account and land on the Diagram Index
- [ ] Returning user can sign in and access their session across navigations
- [ ] Unauthenticated navigation to any app route redirects to sign in
- [ ] `GET /api/me` returns session user — no client-provided identity accepted
- [ ] Sign out destroys session and redirects to sign in
