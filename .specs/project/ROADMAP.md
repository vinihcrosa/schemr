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

**Folder Management** - PLANNED

- Create folders with a name
- Nested folders (folders inside folders, arbitrary depth)
- Move diagrams into folders
- Diagrams not in any folder appear at root level
- Rename and delete folders
- Sidebar shows folder tree with expand/collapse

---

## Future Considerations

- OAuth providers (Google, GitHub) — post-MVP auth extension
- Real-time collaboration (multi-user editing)
- Version history / snapshot diffing
- Diagram search by name or tag
- Sharing Diagrams via public link
- Export to PNG/SVG
