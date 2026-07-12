# Roadmap

**Current Milestone:** M1 — Foundation
**Status:** Planning

---

## M1 — Foundation

**Goal:** App running with auth, DB connected, and a validated end-to-end authenticated roundtrip — deployable to Vercel.
**Target:** End of week 1

### Features

**Project Setup & Infrastructure** - PLANNED

- Docker Compose with PostgreSQL for local dev
- Prisma schema + migrations (User, Diagram models)
- Environment config (local / prod separation)
- Vercel deployment pipeline working

**Authentication** - PLANNED

- Sign up / sign in via NextAuth.js Credentials (email+password only)
- Session management and protected routes
- Server-side session validation on all protected routes
- `userId` derived from session (never from client input)

**Foundation Validation** - PLANNED

- `GET /api/me` — authenticated route returning current user
- Confirms NextAuth.js + Prisma + PostgreSQL are operational end-to-end
- User creation, persistence, and retrieval verified

---

## M2a — Editor Integration

**Goal:** Excalidraw renders and behaves correctly in isolation — no backend involved.
**Target:** Day 1 of week 2

### Features

**Excalidraw Embed** - SPECIFIED

- Embed Excalidraw as the primary drawing interface
- Initialize canvas with static/mock data
- No backend interaction — validate editor behavior in isolation
- Validate serialization/deserialization of Excalidraw data (elements, appState, files)

---

## M2b — Persistence (Manual Save)

**Goal:** Data flows correctly between client and server — save and load a Diagram via explicit user action.
**Target:** Day 2–3 of week 2

### Features

**Diagram API** - PLANNED

- `POST /api/diagrams` — create Diagram
- `PUT /api/diagrams/:id` — update Diagram data
- `GET /api/diagrams/:id` — retrieve Diagram by ID
- `GET /api/diagrams` — list Diagrams for current user
- Ownership validation enforced server-side on all endpoints
- Basic error handling (invalid ID, unauthorized access)

**Save & Load** - PLANNED

- Explicit save via button (no autosave yet)
- Load Diagram from backend by ID
- Validate payload size handling as Diagrams grow

---

## M2c — Autosave & UX Refinement

**Goal:** Usability improvements after core system is stable.
**Target:** Day 4–5 of week 2

### Features

**Autosave** - PLANNED

- Debounce-based autosave (1–2s after last change)
- Prevent concurrent save requests (cancel or dedupe in-flight requests)
- Handle edge cases: rapid edits, tab close, failed saves
- Optional: save indicator, optimistic updates

---

## M3 — Listing & Navigation

**Goal:** Users can see all their Diagrams and navigate to any of them in 1 interaction.
**Target:** End of week 2

### Features

**Diagram Index** - SPECIFIED

- List view with Diagram name + last updated timestamp
- Empty state when no Diagrams exist yet
- Click to open Diagram in editor
- Create new Diagram from the index

**Diagram Management (minimal)** - SPECIFIED

- Rename a Diagram
- Delete a Diagram

---

---

## M4 — Editor Sidebar

**Goal:** Users can switch between diagrams, create new ones, and manage existing ones without leaving the editor — all from a persistent sidebar in the Excalidraw screen.
**Target:** TBD

### Features

**Diagram Sidebar** - PLANNED

- Persistent left sidebar visible while editing any diagram
- Lists all user diagrams; current diagram highlighted
- Click to switch to another diagram (navigate to `/diagrams/:id`)
- Create new diagram from sidebar (POST → navigate to new diagram)
- Rename and delete from sidebar (same behavior as M3 index)
- Collapsible sidebar (toggle to reclaim canvas space)

**Index page rework** - PLANNED

- `/` redirects to the most recently edited diagram, or shows a minimal "no diagrams" screen if none exist
- Full listing page at `/` is replaced by the sidebar; no separate index needed

---

## M5 — Folder Organization

**Goal:** Users can organize diagrams into named folders (nested), with unorganized diagrams shown at root.
**Target:** TBD

### Features

**Folder Management** - SPECIFIED → [spec](../features/m5-folders/spec.md)

- Create folders with a name (P1)
- Sidebar shows folder tree with expand/collapse, root diagrams below folders (P1)
- Rename and delete folders; delete moves diagrams to root — no cascade (P1)
- Drag diagrams into folders or back to root (P1)
- Nested folders via drag — unlimited depth with circular-ref prevention (P1)

---

## M7 — Public Share Link

**Goal:** An owner can expose a single diagram as a read-only public URL, viewable without an account, and revoke it at any time.
**Status:** SHIPPED → [spec](../features/m7-share-link/spec.md)

### Features

**Share Link** - SHIPPED

- Enable a share link on any owned diagram (`shareToken`, single nullable unique column) (P1)
- Public `/share/:token` read-only view (Excalidraw `viewModeEnabled`, no auth, no sidebar) (P1)
- Public payload exposes only diagram name + canvas data — no owner/tags/folders (P1)
- Revoke clears the token; re-enabling mints a new one, old URLs stay dead (P1)
- Persistent "public" indicator + copy-link control in the editor (P2)

---

## AI Diagram MCP — Epic Overview

**Vision:** Expose Schemr's diagram operations to AI agents via an MCP server, so an LLM can create and modify diagrams from natural language and hand the user back an editable canvas.

**Core principle:** The AI **never** writes raw Excalidraw `elements[]`. It speaks Mermaid (or a simple DSL); the server converts and normalizes into valid Excalidraw JSON. The MCP protocol is a thin shell — the value lives in the generation/normalization layer.

**Delivery order:** M8 (auth) → M9 (generation) → M10 (MCP) = usable MVP. M11 (incremental edit) → M12 (polish) after validating real usage.

---

## M8 — Machine Auth (API Keys)

**Goal:** A user can mint and revoke long-lived API keys that authenticate non-browser clients against the existing REST API. Foundation for every later phase.
**Target:** TBD (~0.5 day)

### Features

**API Key Issuance** - SPECIFIED → [spec](../features/m8-api-keys/spec.md)

- `ApiKey` model (id, userId, hashed key, label, scopes, createdAt, lastUsedAt, revokedAt) (P1)
- Generate key = show plaintext once, store only hash (P1)
- Minimal UI in settings/user menu: create, list, revoke (P1)

**Bearer Auth Middleware** - PLANNED

- Accept `Authorization: Bearer <key>` on API routes, in addition to NextAuth session (P1)
- Resolve `userId` from key; reuse existing ownership checks unchanged (P1)
- Update `lastUsedAt`; reject revoked/unknown keys with 401 (P1)

**In scope:** key lifecycle, hash-at-rest, bearer resolution on existing routes.
**Out of scope:** OAuth/device flow, per-route scope enforcement beyond a single `diagrams` scope, rate limiting (M12), key expiry/rotation policies, org/team keys.

---

## M9 — Generation Layer (spec → Excalidraw)

**Goal:** Given a Mermaid spec (or simple DSL), the server produces valid Excalidraw JSON that opens in the canvas with no rendering errors, correct arrow bindings, and stable z-order. Testable without MCP.
**Target:** TBD (~1–2 days)

### Features

**Spec → Diagram Conversion** - PLANNED

- `POST /api/diagrams/from-spec` — accepts `{ name?, folderId?, spec, format: "mermaid" }` (P1)
- Convert via `@excalidraw/mermaid-to-excalidraw` (P1)
- Persist as a normal Diagram; returns `DiagramDetail` (reuses `createDiagram`) (P1)

**Element Normalization** - PLANNED

- Fill required Excalidraw fields: fractional `index`, `seed`, `version`, `versionNonce`, `roundness`, `groupIds` (P1)
- Repair/verify arrow `boundElements` + `startBinding`/`endBinding` so connectors stay attached (P1)
- Deterministic output (no reliance on `Date.now()`/random for identity) (P1)

**Conversion Validation** - PLANNED

- Test suite: spec in → deserialize via `lib/excalidraw.ts` → asserts elements valid + bindings intact (P1)
- Graceful 400 on unparseable spec (P1)

**In scope:** Mermaid support (flowchart, sequence, class, ER — whatever the lib supports), create-only, server-side normalization + tests.
**Out of scope:** editing existing diagrams (M11), auto-layout beyond what Mermaid gives (M12), custom DSL (only if Mermaid proves insufficient), styling/theming controls, image/file elements, thumbnails.

---

## M10 — MCP Server (thin shell)

**Goal:** An AI agent, authenticated with an API key, can list, read, create-from-spec, and delete diagrams over MCP, and receive a shareable link back.
**Target:** TBD (~0.5–1 day)

### Features

**MCP Tools** - PLANNED

- `list_diagrams`, `get_diagram` (P1)
- `create_diagram_from_spec` (wraps M9 endpoint) (P1)
- `delete_diagram` (P1)
- Returns diagram id + URL; offers share link via existing M7 `shareToken` when asked (P2)

**Transport & Auth** - PLANNED

- MCP server authenticates to REST using the caller's API key (M8) (P1)
- Config/docs for wiring the server into an MCP client (P1)

**In scope:** thin protocol wrapper over M8+M9 REST, create/read/list/delete, link return.
**Out of scope:** incremental edit tools (M11), server-side agent orchestration, streaming/progress, multi-tenant hosting, non-MCP integrations.

---

## M11 — Incremental Editing

**Goal:** The AI can modify an existing diagram — add/connect/update/remove elements — while preserving untouched layout and existing bindings.
**Target:** TBD (post-MVP)

### Features

**Element-Level Operations** - PLANNED

- `add_node`, `connect`, `update_node`, `remove_element` operating on a live diagram (P1)
- Stable element IDs surfaced to the agent for targeting (P1)
- Merge changes without breaking existing `boundElements`/bindings or reflowing untouched nodes (P1)

**In scope:** additive + targeted edits on existing diagrams, ID-stable merge/diff.
**Out of scope:** full re-layout on edit, conflict resolution vs. concurrent human edits, undo/history, semantic "rewrite whole diagram from new spec" (that's re-create via M9).

---

## M12 — Polish & Hardening

**Goal:** Production-quality edges: layout quality, thumbnails, and abuse protection on the machine-facing surface.
**Target:** TBD (post-MVP)

### Features

**Auto-Layout** - PLANNED

- Server-side layout (e.g. dagre) so agents can omit coordinates and still get readable diagrams (P2)

**Thumbnails** - PLANNED

- Populate the existing `Diagram.thumbnail` field on create-from-spec (P2)

**Rate Limiting** - PLANNED

- Per-key rate limits on MCP/machine routes (P2)

**In scope:** layout quality, thumbnail generation, rate limiting on API-key routes.
**Out of scope:** billing/quotas, analytics dashboards, multi-region, caching layers.

---

## Future Considerations

- OAuth providers (Google, GitHub) — post-MVP auth extension
- Real-time collaboration (multi-user editing)
- Version history / snapshot diffing
- Auto-generated thumbnails on save (field exists, not yet populated)
- Export to PNG/SVG / `.excalidraw`
- Full-text search inside diagram content (element text)
