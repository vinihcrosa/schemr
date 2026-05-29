# Search + Tags Tasks

**Design**: `.specs/features/m6-search-tags/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1 — Foundation (Sequential):
  T1 → T2 → T3

Phase 2 — API Routes (Sequential — integration tests not parallel-safe):
  T4 → T5 → T6

Phase 3 — UI Primitives (Parallel — unit tests, parallel-safe):
  T7 [P], T8 [P]

Phase 4 — Composite UI (Parallel — unit, parallel-safe; all need T7):
  T9 [P], T10 [P], T11 [P]

Phase 5 — Sidebar Integration (Parallel — unit, parallel-safe; all need Phase 4):
  T12 [P], T13 [P]

Phase 6 — Sidebar Wiring (Sequential):
  T14 → T15

Phase 7 — E2E (Sequential — not parallel-safe):
  T16 → T17
```

```
T1 → T2 → T3 → T4 → T5 → T6
                              ├── T7 [P] ──────────────────────────────────┐
                              └── T8 [P] ──────────────────────────────────┤
                                          T7 done:                         │
                                          ├── T9  [P] ──────────────────── ┤
                                          ├── T10 [P] ──────────────────── ┤
                                          └── T11 [P] ──────────────────── ┤
                                                      T7-T11 + T8 done:    │
                                                      ├── T12 [P] ──────── ┤
                                                      └── T13 [P] ──────── ┤
                                                                  T12+T13: │
                                                                  T14 → T15 → T16 → T17
```

---

## Task Breakdown

### T1: Add Tag + DiagramTag models to Prisma schema + run migration

**What**: Add `Tag` and `DiagramTag` models to `schema.prisma`, add back-relations to `User` and `Diagram`, generate client, run migration.
**Where**: `prisma/schema.prisma`
**Depends on**: None
**Reuses**: Existing Folder/DiagramTag patterns in schema (composite PK, cascade deletes)
**Requirement**: TAG-01, TAG-02, TAG-04, TAG-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `Tag` model added with `@@unique([userId, name])` and `@@index([userId])`
- [ ] `DiagramTag` model added with `@@id([diagramId, tagId])` and `onDelete: Cascade` on both FKs
- [ ] `User.tags Tag[]` back-relation added
- [ ] `Diagram.tags DiagramTag[]` back-relation added
- [ ] `prisma migrate dev --name add-tags` ran successfully
- [ ] `npx prisma generate` ran with no errors
- [ ] Gate check passes: `npm run build` (TypeScript compiles with new generated types)

**Tests**: none (schema change — verified by build + migration success)
**Gate**: build

**Commit**: `feat(prisma): add Tag and DiagramTag models`

---

### T2: Create lib/tags.ts with all tag data functions

**What**: New file `lib/tags.ts` exporting `listTags`, `createTag`, `deleteTag`, `assignTag`, `removeTag`.
**Where**: `lib/tags.ts` (new file)
**Depends on**: T1
**Reuses**: `db` Prisma client import pattern from `lib/diagrams.ts`; `TagSummary` type defined here
**Requirement**: TAG-01, TAG-02, TAG-03, TAG-04, TAG-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `TagSummary = { id: string; name: string }` type exported
- [ ] `listTags(userId)` returns `TagSummary[]` ordered by name
- [ ] `createTag(userId, name)` trims name, creates tag, returns `TagSummary`
- [ ] `deleteTag(userId, tagId)` verifies ownership before delete
- [ ] `assignTag(userId, diagramId, tagId)` verifies diagram + tag ownership before upsert
- [ ] `removeTag(userId, diagramId, tagId)` verifies ownership before delete
- [ ] Unit tests written covering all functions (success paths + ownership guard)
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(lib): add tags data access functions`

---

### T3: Extend listDiagrams to include tags + update DiagramSummary type

**What**: Update `DiagramSummary` type and `listDiagrams` Prisma query to return `tags: TagSummary[]` per diagram.
**Where**: `lib/diagrams.ts`
**Depends on**: T2 (needs `TagSummary` type)
**Reuses**: Existing `listDiagrams` select pattern
**Requirement**: TAG-06, TAG-11 (chips need tag data in sidebar items)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `DiagramSummary` type gains `tags: TagSummary[]` field
- [ ] Prisma query adds `include: { tags: { select: { tag: { select: { id: true, name: true } } } } }` and maps to flat `TagSummary[]`
- [ ] Integration test: diagram with 2 assigned tags → `listDiagrams` returns both tags in result
- [ ] Integration test: diagram with no tags → returns empty `tags: []`
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(lib): extend DiagramSummary with tags field`

---

### T4: GET /api/tags + POST /api/tags routes

**What**: `app/api/tags/route.ts` handling `GET` (list tags) and `POST` (create tag).
**Where**: `app/api/tags/route.ts` (new file)
**Depends on**: T2
**Reuses**: `requireSession` auth pattern + Zod `.safeParse()` pattern from `app/api/diagrams/route.ts`
**Requirement**: TAG-01, TAG-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `GET` returns `200` with `TagSummary[]` for authenticated user
- [ ] `POST` validates `{ name }` with `z.string().min(1).max(32).trim()`
- [ ] `POST` returns `201` with created tag on success
- [ ] `POST` returns `400` with field error on empty/whitespace name
- [ ] `POST` returns `409` with `"Tag already exists"` on duplicate `[userId, name]` (catches Prisma `P2002`)
- [ ] `GET` + `POST` return `401` when unauthenticated
- [ ] Integration tests covering all above cases
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add GET and POST /api/tags routes`

---

### T5: DELETE /api/tags/:id route

**What**: `app/api/tags/[id]/route.ts` handling `DELETE` (delete tag + cascade cleanup).
**Where**: `app/api/tags/[id]/route.ts` (new file)
**Depends on**: T2
**Reuses**: `app/api/diagrams/[id]/route.ts` pattern (ownership check + delete)
**Requirement**: TAG-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `DELETE` returns `204` on success
- [ ] `DELETE` returns `404` when tag not found or belongs to another user
- [ ] `DELETE` returns `401` when unauthenticated
- [ ] Integration test: deleting tag removes `DiagramTag` join rows (cascade verified by checking diagram no longer has tag)
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add DELETE /api/tags/:id route`

---

### T6: POST + DELETE /api/diagrams/:id/tags/:tagId routes

**What**: `app/api/diagrams/[id]/tags/[tagId]/route.ts` handling tag assignment and removal.
**Where**: `app/api/diagrams/[id]/tags/[tagId]/route.ts` (new file)
**Depends on**: T2
**Reuses**: Auth + ownership check pattern from other diagram routes
**Requirement**: TAG-04, TAG-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `POST` assigns tag to diagram, returns `201`; idempotent (upsert — no error if already assigned)
- [ ] `DELETE` removes tag from diagram, returns `204`
- [ ] Both routes return `404` when diagram or tag not owned by session user
- [ ] Both routes return `401` when unauthenticated
- [ ] Integration tests covering all above cases
- [ ] Gate check passes: `npm run lint && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add tag assignment routes for diagrams`

---

### T7: TagChip component [P]

**What**: New primitive `TagChip` component rendering a tag name as a pill, with optional remove and active state.
**Where**: `components/sidebar/TagChip.tsx` (new file)
**Depends on**: None (pure UI primitive)
**Reuses**: Existing sidebar CSS classNames patterns
**Requirement**: TAG-06, TAG-08, TAG-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Renders `name` as pill
- [ ] When `onRemove` provided → shows × button; clicking calls `onRemove()`
- [ ] When `active={true}` → applies highlighted styling (distinct border/background)
- [ ] Unit tests: renders name, × appears only with `onRemove`, `active` class applied
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add TagChip component`

---

### T8: SearchInput component [P]

**What**: New controlled `SearchInput` component for sidebar diagram name search.
**Where**: `components/sidebar/SearchInput.tsx` (new file)
**Depends on**: None (pure UI primitive)
**Reuses**: Existing sidebar CSS patterns
**Requirement**: SRCH-01, SRCH-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Renders controlled `<input>` bound to `value` + `onChange(value)`
- [ ] × clear button visible only when `value` is non-empty; clicking calls `onClear()`
- [ ] Unit tests: input updates, × appears/disappears, clear calls `onClear`
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add SearchInput component`

---

### T9: TagFilter component [P]

**What**: Horizontal scrollable row of `TagChip` pills for tag filtering in the sidebar.
**Where**: `components/sidebar/TagFilter.tsx` (new file)
**Depends on**: T7 (uses `TagChip`)
**Reuses**: `TagChip` active/onRemove props
**Requirement**: TAG-07, TAG-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Renders one `TagChip` per tag in `tags[]`
- [ ] Chip with `id === activeTagId` renders with `active={true}`
- [ ] Clicking active chip calls `onSelect(null)` (deselects)
- [ ] Clicking inactive chip calls `onSelect(tagId)`
- [ ] Empty `tags[]` renders nothing (no empty state — TagFilter hidden when no tags)
- [ ] Unit tests covering selection and deselection
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add TagFilter component`

---

### T10: TagManager component [P]

**What**: Inline panel for tag CRUD — create form + tag list with delete confirmation.
**Where**: `components/sidebar/TagManager.tsx` (new file)
**Depends on**: T7 (uses `TagChip` for list items)
**Reuses**: 3-state delete confirm pattern from `SidebarItem` (idle → confirm → executing)
**Requirement**: TAG-01, TAG-02, TAG-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Lists all `tags` with delete button per item
- [ ] Create form: controlled input + submit; calls `onCreate(name)` on submit
- [ ] Create form: inline error shown when name is empty/whitespace (client-side, before API call)
- [ ] Create form: inline error shown when name exceeds 32 chars (client-side)
- [ ] Delete: two-step confirm (click delete → confirm/cancel buttons appear)
- [ ] Confirmed delete calls `onDelete(tagId)`
- [ ] `onClose()` called when user dismisses panel
- [ ] Unit tests: create error states, delete 2-step flow, list rendering
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add TagManager component`

---

### T11: TagPicker component [P]

**What**: Dropdown combobox for assigning/removing tags on a diagram.
**Where**: `components/sidebar/TagPicker.tsx` (new file)
**Depends on**: T7 (uses `TagChip` for selected tag display)
**Reuses**: Click-outside + Escape close pattern used in existing sidebar rename flows
**Requirement**: TAG-04, TAG-05, TAG-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Lists `availableTags`; assigned tags (`assignedTagIds`) visually distinct (checkmark or filled style)
- [ ] Clicking unassigned tag calls `onAssign(tagId)` and marks it assigned
- [ ] Clicking assigned tag calls `onRemove(tagId)` and unmarks it
- [ ] When `availableTags` is empty → shows "Create a tag first" message
- [ ] Escape keydown calls `onClose()`
- [ ] Click outside calls `onClose()`
- [ ] Unit tests: assignment toggle, empty state, keyboard close
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add TagPicker component`

---

### T12: Extend SidebarItem with tag chips + TagPicker [P]

**What**: Extend `SidebarItem` to accept tag props, show `TagChip` list on current diagram, and open `TagPicker`.
**Where**: `components/sidebar/SidebarItem.tsx`
**Depends on**: T7, T11 (TagChip, TagPicker)
**Reuses**: Existing `SidebarItem` props + mode state machine; hover-reveal button pattern
**Requirement**: TAG-04, TAG-05, TAG-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Props extended: `tags: TagSummary[]`, `allTags: TagSummary[]`, `onTagAssign`, `onTagRemove`
- [ ] Tag chips rendered only when `isCurrent` (P1 scope)
- [ ] "Add tag" button visible on current diagram item (hover-reveal or always-visible)
- [ ] Clicking "Add tag" opens `TagPicker` overlay
- [ ] When `allTags` is empty → shows "Create a tag first" link (opens TagManager)
- [ ] Unit tests: chips render on current, hidden on non-current, picker toggle
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(sidebar): extend SidebarItem with tag chips and picker`

---

### T13: Extend DiagramSidebar — search state + filter logic + SearchInput + TagFilter [P]

**What**: Add `searchQuery` + `activeTagId` state, `filteredDiagrams` memo, and render `SearchInput` + `TagFilter` in expanded sidebar.
**Where**: `components/sidebar/DiagramSidebar.tsx`
**Depends on**: T8, T9 (SearchInput, TagFilter)
**Reuses**: Existing `flatDiagrams` state + `useMemo` pattern; existing tree/flat render branches
**Requirement**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, TAG-07, TAG-08, TAG-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `searchQuery: string` state initialized to `""`
- [ ] `activeTagId: string | null` state initialized to `null`
- [ ] `filteredDiagrams` memo: intersection of name filter (case-insensitive) + tag filter
- [ ] `SearchInput` rendered at top of sidebar when `!collapsed`
- [ ] `TagFilter` rendered below search when `tags.length > 0` and `!collapsed`
- [ ] When `searchQuery || activeTagId` → renders `filteredDiagrams` as flat list (no folders)
- [ ] When filtered list is empty → renders single empty state ("No diagrams match")
- [ ] When both cleared → restores `buildSidebarTree()` branch
- [ ] Unit tests: filter logic covers name-only, tag-only, intersection, empty state, restore
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(sidebar): add search and tag filter state to DiagramSidebar`

---

### T14: Extend DiagramSidebar — tag management + mutation handlers

**What**: Add `initialTags` prop, `tags` state, `tagManagerOpen` state, TagManager panel, and all tag mutation handlers with optimistic updates.
**Where**: `components/sidebar/DiagramSidebar.tsx`
**Depends on**: T10, T12, T13 (TagManager component + extended SidebarItem + search state from T13)
**Reuses**: Existing optimistic update pattern (immediate state change → API call → rollback on error) from folder/diagram handlers
**Requirement**: TAG-01, TAG-02, TAG-03, TAG-04, TAG-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `initialTags: TagSummary[]` prop added; `tags` state initialized from it
- [ ] `tagManagerOpen: boolean` state; "Manage tags" button in sidebar header opens it
- [ ] `TagManager` panel rendered conditionally; `onClose` closes it
- [ ] `handleCreateTag(name)` — optimistic add → `POST /api/tags` → rollback on error
- [ ] `handleDeleteTag(tagId)` — optimistic remove → `DELETE /api/tags/:id` → rollback; removes from `flatDiagrams` tag lists
- [ ] `handleAssignTag(diagramId, tagId)` — optimistic → `POST /api/diagrams/:id/tags/:tagId` → rollback
- [ ] `handleRemoveTag(diagramId, tagId)` — optimistic → `DELETE /api/diagrams/:id/tags/:tagId` → rollback
- [ ] Handlers passed down to `SidebarItem` via render props
- [ ] Unit tests: optimistic update + rollback for each handler (mock fetch)
- [ ] Gate check passes: `npm run lint && npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(sidebar): add tag management handlers and TagManager to DiagramSidebar`

---

### T15: Extend page.tsx to fetch and pass initialTags

**What**: Add `listTags(userId)` to the parallel server fetch in the diagram page and pass `initialTags` prop to `DiagramSidebar`.
**Where**: `app/(app)/diagrams/[id]/page.tsx`
**Depends on**: T2, T14 (listTags function + DiagramSidebar accepts initialTags prop)
**Reuses**: Existing `Promise.all([getDiagramById, listDiagrams, listFolders])` pattern
**Requirement**: TAG-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `listTags(session.user.id)` added to `Promise.all` destructure
- [ ] `initialTags` prop passed to `<DiagramSidebar>`
- [ ] TypeScript compiles with no errors
- [ ] Gate check passes: `npm run build`

**Tests**: none (server component plumbing — covered by E2E in T16/T17)
**Gate**: build

**Commit**: `feat(page): pass initialTags to DiagramSidebar`

---

### T16: E2E — search flow

**What**: Playwright E2E tests covering the full search user journey (SRCH-01 to SRCH-05).
**Where**: `e2e/search.spec.ts` (new file)
**Depends on**: T15 (full feature integrated)
**Reuses**: Existing Playwright test helpers + auth fixtures (sign-in flow)
**Requirement**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05

**Tools**:
- MCP: `mcp__playwright__*` (for interactive debugging if needed)
- Skill: NONE

**Done when**:
- [ ] Test: search input visible in expanded sidebar, hidden when collapsed
- [ ] Test: type partial name → only matching diagrams shown (exact count verified)
- [ ] Test: type query with no matches → empty state "No diagrams match" shown
- [ ] Test: clear input → folder tree restored
- [ ] Test: diagram inside nested folder matched by search → appears at root level in flat list
- [ ] All tests pass: `npm run test:e2e -- --grep "search"`
- [ ] Gate check passes: `npm run lint && npm run test:e2e`

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): add search flow specs`

---

### T17: E2E — tags flow

**What**: Playwright E2E tests covering tag CRUD, assignment, filtering, and search+tag composition (TAG-01 to TAG-09).
**Where**: `e2e/tags.spec.ts` (new file)
**Depends on**: T16 (sequential — E2E not parallel-safe)
**Reuses**: Playwright auth fixtures; `listTags` API for test setup/teardown
**Requirement**: TAG-01, TAG-02, TAG-03, TAG-04, TAG-05, TAG-06, TAG-07, TAG-08, TAG-09

**Tools**:
- MCP: `mcp__playwright__*` (for interactive debugging if needed)
- Skill: NONE

**Done when**:
- [ ] Test: create tag "infra" → appears in TagManager list
- [ ] Test: create duplicate "infra" → inline error "Tag already exists" shown
- [ ] Test: assign "infra" to diagram → chip appears on current diagram sidebar item
- [ ] Test: remove chip → chip disappears
- [ ] Test: delete tag → gone from list; chip removed from all diagrams
- [ ] Test: click "infra" filter → sidebar shows only diagrams tagged "infra" (count verified)
- [ ] Test: click active filter again → deselects, full tree restored
- [ ] Test: search + tag filter active simultaneously → intersection result shown
- [ ] All tests pass: `npm run test:e2e -- --grep "tags"`
- [ ] Gate check passes: `npm run lint && npm run test:e2e`

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): add tags CRUD, assignment, and filter specs`

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: Prisma schema + migration | 1 file change + CLI command | ✅ Granular |
| T2: lib/tags.ts | 1 new file, cohesive data layer | ✅ Granular |
| T3: Extend listDiagrams | 1 file, 1 query change | ✅ Granular |
| T4: GET+POST /api/tags | 1 new file, 2 methods (same route) | ✅ Granular |
| T5: DELETE /api/tags/:id | 1 new file, 1 method | ✅ Granular |
| T6: POST+DELETE /api/diagrams/:id/tags/:tagId | 1 new file, 2 methods (same route) | ✅ Granular |
| T7: TagChip | 1 new component | ✅ Granular |
| T8: SearchInput | 1 new component | ✅ Granular |
| T9: TagFilter | 1 new component | ✅ Granular |
| T10: TagManager | 1 new component | ✅ Granular |
| T11: TagPicker | 1 new component | ✅ Granular |
| T12: Extend SidebarItem | 1 file modification | ✅ Granular |
| T13: DiagramSidebar search+filter | 1 file, 1 concern (read path) | ✅ Granular |
| T14: DiagramSidebar tag management | 1 file, 1 concern (write path) | ✅ Granular |
| T15: page.tsx fetch | 1 file, 1 line change + prop | ✅ Granular |
| T16: E2E search | 1 spec file, 1 feature | ✅ Granular |
| T17: E2E tags | 1 spec file, 1 feature | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Start of chain | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T2 | T3 → T4 | ✅ Match |
| T5 | T2 | T4 → T5 | ✅ Match |
| T6 | T2 | T5 → T6 | ✅ Match |
| T7 | None (after T6 phase gate) | T6 unlocks T7 [P] | ✅ Match |
| T8 | None (after T6 phase gate) | T6 unlocks T8 [P] | ✅ Match |
| T9 | T7 | T7 → T9 [P] | ✅ Match |
| T10 | T7 | T7 → T10 [P] | ✅ Match |
| T11 | T7 | T7 → T11 [P] | ✅ Match |
| T12 | T7, T11 | T7+T11 → T12 [P] | ✅ Match |
| T13 | T8, T9 | T8+T9 → T13 [P] | ✅ Match |
| T14 | T10, T12, T13 | T10+T12+T13 → T14 | ✅ Match |
| T15 | T2, T14 | T14 → T15 | ✅ Match |
| T16 | T15 | T15 → T16 | ✅ Match |
| T17 | T16 | T16 → T17 | ✅ Match |

---

## Test Co-location Validation

| Task | Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Prisma schema / migration | none | none | ✅ OK |
| T2 | `lib/tags.ts` | Unit | unit | ✅ OK |
| T3 | `lib/diagrams.ts` (Prisma query) | Integration | integration | ✅ OK |
| T4 | `app/api/tags/route.ts` | Integration | integration | ✅ OK |
| T5 | `app/api/tags/[id]/route.ts` | Integration | integration | ✅ OK |
| T6 | `app/api/diagrams/[id]/tags/[tagId]/route.ts` | Integration | integration | ✅ OK |
| T7 | `components/sidebar/TagChip.tsx` | Unit | unit | ✅ OK |
| T8 | `components/sidebar/SearchInput.tsx` | Unit | unit | ✅ OK |
| T9 | `components/sidebar/TagFilter.tsx` | Unit | unit | ✅ OK |
| T10 | `components/sidebar/TagManager.tsx` | Unit | unit | ✅ OK |
| T11 | `components/sidebar/TagPicker.tsx` | Unit | unit | ✅ OK |
| T12 | `components/sidebar/SidebarItem.tsx` | Unit | unit | ✅ OK |
| T13 | `components/sidebar/DiagramSidebar.tsx` | Unit | unit | ✅ OK |
| T14 | `components/sidebar/DiagramSidebar.tsx` | Unit | unit | ✅ OK |
| T15 | `app/(app)/diagrams/[id]/page.tsx` | none (server plumbing) | none | ✅ OK |
| T16 | `e2e/search.spec.ts` | E2E | e2e | ✅ OK |
| T17 | `e2e/tags.spec.ts` | E2E | e2e | ✅ OK |

---

## Requirement Traceability

| Req ID | Tasks |
|---|---|
| SRCH-01 | T13 + T16 |
| SRCH-02 | T13 + T16 |
| SRCH-03 | T13 + T16 |
| SRCH-04 | T13 + T16 |
| SRCH-05 | T13 + T16 |
| TAG-01 | T2, T4, T14, T15 + T17 |
| TAG-02 | T2, T5, T14 + T17 |
| TAG-03 | T4, T10 + T17 |
| TAG-04 | T2, T6, T11, T12, T14 + T17 |
| TAG-05 | T2, T6, T11, T12, T14 + T17 |
| TAG-06 | T7, T12 + T17 |
| TAG-07 | T13 + T17 |
| TAG-08 | T7, T9 + T17 |
| TAG-09 | T13 + T17 |
| TAG-10 | Deferred (P2) |
| TAG-11 | Deferred (P2) |

**Coverage**: 15/16 P1 requirements mapped. TAG-10 and TAG-11 are P2 — deferred.
