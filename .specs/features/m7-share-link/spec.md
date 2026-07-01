# Public Share Link Specification

## Problem Statement

Diagrams created in Schemr are trapped behind authentication — the only way to show one to
someone else is to screenshot it or give them your account. For a tool whose whole purpose is
sketching architectures and flows to *communicate* ideas, having no way to hand a colleague a link
is a glaring gap. A read-only public share link lets an owner expose a single diagram to anyone
with the URL, without granting account access or edit rights.

## Goals

- [ ] Owner can turn any diagram into a public, read-only URL in ≤ 2 clicks and copy it to the clipboard.
- [ ] Anyone with the link can view the diagram (view-only, no auth) — the view always reflects the latest saved state.
- [ ] Owner can revoke a share at any time; revoked links stop working immediately and cannot be reactivated to the same URL.
- [ ] A share link exposes only the diagram name and canvas content — never the owner's identity, tags, folders, or other diagrams.

## Out of Scope

| Feature | Reason |
|---|---|
| Password-protected links | Adds auth surface; opaque unguessable token is enough for v1 |
| Link expiry / TTL | Deferred — manual revoke covers the need |
| Edit / comment access via link | This feature is read-only sharing only; collaboration is a separate milestone |
| View analytics (view count, viewer list) | Deferred — no tracking infra in v1 |
| Snapshot / freeze at share time | v1 shares live latest-saved state; version pinning is a separate concern |
| Embedding (`<iframe>` / oEmbed) | Deferred; the standalone `/share/:token` page covers the core need |
| PNG/SVG export from the share page | Belongs to the Export feature, not sharing |
| Sharing folders or multiple diagrams at once | Per-diagram only in v1 |

---

## User Stories

### P1: Enable a share link ⭐ MVP

**User Story**: As a diagram owner, I want to publish my diagram as a public link so that I can send it to someone who doesn't have a Schemr account.

**Why P1**: The core value — without minting a link there is nothing to share.

**Acceptance Criteria**:

1. WHEN the owner opens the share control on a diagram they own THEN system SHALL show whether the diagram is currently shared or private.
2. WHEN the owner enables sharing on a private diagram THEN system SHALL generate a cryptographically-unguessable `shareToken`, persist it, and return the full share URL (`{origin}/share/{token}`).
3. WHEN a share link has been generated THEN system SHALL display the URL with a one-click "Copy link" action.
4. WHEN the owner enables sharing THEN system SHALL only permit this on a diagram owned by the current session user (ownership enforced server-side).
5. WHEN sharing is already enabled and the owner re-opens the control THEN system SHALL show the existing URL without minting a new token.

**Independent Test**: On an owned diagram, click Share → toggle on → a `/share/…` URL appears and copies to clipboard. Re-open → same URL shown.

---

### P1: View a shared diagram without auth ⭐ MVP

**User Story**: As anyone with the link, I want to open the URL and see the diagram so that I can review it without signing in.

**Why P1**: The receiving half of the feature; a link nobody can open has no value.

**Acceptance Criteria**:

1. WHEN an unauthenticated visitor opens `/share/{token}` for a valid, active token THEN system SHALL render the diagram in a read-only Excalidraw canvas (`viewModeEnabled`, no save, no autosave, no sidebar).
2. WHEN the shared diagram is rendered THEN system SHALL display the diagram name.
3. WHEN the visitor opens the page THEN system SHALL expose only the diagram `name` and canvas `data` in the response payload — never `userId`, owner email, tags, folder, or any other diagram's data.
4. WHEN the token does not exist or has been revoked THEN system SHALL return a 404 page ("This link is no longer available"), not a redirect to sign-in.
5. WHEN an authenticated user (including the owner) opens a valid share URL THEN system SHALL render the same read-only view (no special owner controls on the share page).

**Independent Test**: Copy a share URL, open in an incognito window → diagram renders read-only with its name, no editing possible, no sidebar.

---

### P1: Revoke a share link ⭐ MVP

**User Story**: As a diagram owner, I want to turn a share link off so that I can stop sharing a diagram I no longer want public.

**Why P1**: Sharing without revocation is a one-way door; users won't trust the feature without an off switch.

**Acceptance Criteria**:

1. WHEN the owner disables sharing on a shared diagram THEN system SHALL clear the `shareToken` (set to null) via an owner-authenticated request.
2. WHEN a token has been revoked THEN system SHALL cause any subsequent request to the old `/share/{token}` URL to return 404.
3. WHEN the owner re-enables sharing after revoking THEN system SHALL mint a **new** token — the previously revoked URL SHALL remain dead.
4. WHEN the owner disables sharing THEN system SHALL ask for confirmation before revoking (guards against accidental link death).

**Independent Test**: Share a diagram, open the link (works). Revoke. Reload the link → 404. Re-enable → a different URL is issued; the old one still 404s.

---

### P2: Share state visible in the editor

**User Story**: As an owner, I want to see at a glance whether the diagram I'm editing is currently public so that I don't accidentally leave something shared.

**Why P2**: Improves trust and awareness, but the P1 share control already surfaces state when opened.

**Acceptance Criteria**:

1. WHEN a diagram is currently shared THEN system SHALL show a persistent "shared/public" indicator in the editor chrome (e.g. next to the diagram title or share button).
2. WHEN a diagram is private THEN system SHALL show a neutral/default share affordance with no "public" indicator.

**Independent Test**: Enable sharing → editor shows a public indicator. Revoke → indicator disappears.

---

## Edge Cases

- WHEN a shared diagram is deleted THEN system SHALL cause its share URL to return 404 (token gone with the row).
- WHEN the owner edits and saves a shared diagram THEN system SHALL cause the share page to reflect the new content on next load (live, not snapshot).
- WHEN a `shareToken` collides with an existing one on generation THEN system SHALL retry generation (unique constraint enforced at DB level).
- WHEN a visitor opens a share URL with a malformed token THEN system SHALL return 404, not a 500.
- WHEN the diagram `data` is empty THEN system SHALL render an empty read-only canvas with the name, not an error.
- WHEN a non-owner authenticated user attempts to enable/revoke sharing on a diagram they don't own THEN system SHALL return 403/404 without mutating state.

---

## Data Model

```
Diagram (additive change)
  ...existing fields...
  shareToken  String?  @unique   // null = private; present = publicly shared

  @@index on shareToken via @unique
```

Rationale: a single nullable, unique token models the whole feature. Presence = shared, absence =
private. Revoking sets it to null; re-enabling generates a fresh value, so old links can never be
resurrected. No separate boolean, no snapshot table.

New / changed API surface:

- `POST   /api/diagrams/:id/share`   — owner-only; mints `shareToken` if absent, returns `{ shareToken, url }`. Idempotent (returns existing token if already shared).
- `DELETE /api/diagrams/:id/share`   — owner-only; clears `shareToken`. Returns 204.
- `GET    /api/share/:token`         — **public, no auth**; returns `{ name, data }` for the diagram with that token, or 404. Never returns owner or relational data.

New page:

- `/share/[token]` — public route, outside the authenticated `(app)` layout group. Server component fetches by token, renders a read-only `ExcalidrawCanvas` variant (`viewModeEnabled`, no `diagramId` save wiring).

`getDiagramDetail` for owners expands to include `shareToken` so the editor can show current share state.

---

## Security Notes

- Token MUST be generated with a CSPRNG (e.g. `crypto.randomUUID()` / `crypto.randomBytes` → base64url), ≥ 128 bits of entropy, so URLs are unguessable and unenumerable.
- The public `GET /api/share/:token` endpoint MUST select only `name` and `data` columns — never `userId`, `user`, `tags`, `folderId`. No relational includes.
- Share mutation endpoints (`POST`/`DELETE /api/diagrams/:id/share`) MUST enforce ownership from the session (`userId` from session, never client input) exactly as existing diagram endpoints do.
- The public share route MUST NOT be caught by the auth middleware redirect — unauthenticated access is required by design.

---

## Requirement Traceability

| Requirement ID | Story | Status |
|---|---|---|
| SHARE-01 | P1: Share control shows current shared/private state | Pending |
| SHARE-02 | P1: Enable minting unguessable token + return URL | Pending |
| SHARE-03 | P1: One-click copy link | Pending |
| SHARE-04 | P1: Enable is owner-only (server-enforced) | Pending |
| SHARE-05 | P1: Re-open shared diagram returns same token (idempotent) | Pending |
| SHARE-06 | P1: Public `/share/:token` renders read-only canvas, no auth | Pending |
| SHARE-07 | P1: Share view shows diagram name | Pending |
| SHARE-08 | P1: Payload exposes only name + data (no owner/relational leak) | Pending |
| SHARE-09 | P1: Invalid/revoked token → 404 (not sign-in redirect) | Pending |
| SHARE-10 | P1: Authenticated user opening share URL sees read-only view | Pending |
| SHARE-11 | P1: Revoke clears token (owner-only) | Pending |
| SHARE-12 | P1: Revoked token → 404 on subsequent access | Pending |
| SHARE-13 | P1: Re-enable mints new token; old URL stays dead | Pending |
| SHARE-14 | P1: Revoke asks for confirmation | Pending |
| SHARE-15 | P2: Persistent public indicator in editor when shared | Pending |

**Coverage:** 15 total, 0 mapped to tasks, 15 unmapped ⚠️

---

## Success Criteria

- [ ] Owner mints a shareable URL and copies it in ≤ 2 clicks.
- [ ] An incognito visitor opens the URL and sees a read-only diagram with its name — no auth prompt.
- [ ] Revoked and malformed tokens both return 404, never a stack trace or sign-in redirect.
- [ ] Public share payload contains only `name` and `data` — verified by inspecting the network response.
- [ ] Token is ≥ 128-bit CSPRNG output — unguessable and unenumerable.
