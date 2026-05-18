# Folders Feature Tasks

**Design**: `.specs/features/m5-folders/design.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Schema Foundation (Sequential)

```
T1
```

### Phase 2: Parallel (no integration tests — unblocked after T1)

```
T1 ──┬──→ T2 [P]
     └──→ T3 [P]
```

### Phase 3: Sequential Integration Chain (after T1)

Integration tests are NOT parallel-safe (shared DB). All run in one sequence.

```
T1 ──→ T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8
```

### Phase 4: Parallel UI Components (after T3 + T2 done)

Unit tests are parallel-safe.

```
T3, T2 done ──┬──→ T9 [P]
              └──→ T10 [P]
```

### Phase 5: Server Component Update (Sequential, after T5 + T6 + T8 + T3 done)

```
T5, T6, T8, T3 done ──→ T11
```

### Phase 6: DiagramSidebar Refactor (Sequential, after T9 + T10 + T11 done)

E2E tests are NOT parallel-safe.

```
T9, T10, T11 done ──→ T12
```

---

## Task Breakdown

### T1: Prisma Schema — Add Folder Model + Diagram.folderId

**What**: Add `Folder` model with self-referencing parent, add `folderId` nullable to `Diagram`, add `folders` relation to `User`, run migration.
**Where**: `prisma/schema.prisma`, `prisma/migrations/`
**Depends on**: None
**Reuses**: Existing `Diagram` model pattern
**Requirements**: FOLD-03, FOLD-15

**Done when**:

- [ ] `Folder` model added with `id`, `name`, `userId`, `parentFolderId?`, `parent`, `children`, `diagrams`, `createdAt`, `updatedAt`, `@@index([userId])`, `@@index([parentFolderId])`
- [ ] `Folder.parent` relation uses `onDelete: SetNull`
- [ ] `Diagram.folderId String?` + `folder Folder? @relation(...)` added with `onDelete: SetNull`
- [ ] `User.folders Folder[]` added
- [ ] Migration runs: `npx prisma migrate dev --name add_folders`
- [ ] Client generated: `npx prisma generate`
- [ ] Gate passes: `npm run lint`

**Tests**: none (schema is tested implicitly by integration suites in T4–T8)
**Gate**: `npm run lint`

**Commit**: `feat(db): add Folder model and Diagram.folderId to schema`

---

### T2: lib/sidebar-tree.ts — buildSidebarTree + isDescendant [P]

**What**: Pure utility — assembles flat `FolderSummary[]` + `DiagramEntry[]` from server into nested `SidebarData` tree; includes `isDescendant` for circular-ref prevention.
**Where**: `lib/sidebar-tree.ts` (new)
**Depends on**: T1 (type shapes informed by schema)
**Reuses**: Nothing — pure new utility
**Requirements**: FOLD-04, FOLD-15, FOLD-16

**Interfaces**:

```typescript
export type DiagramEntry = { id: string; name: string; updatedAt: string }
export type FolderNode = {
  id: string; name: string; parentFolderId: string | null
  children: FolderNode[]; diagrams: DiagramEntry[]
}
export type SidebarData = { folders: FolderNode[]; rootDiagrams: DiagramEntry[] }
export type FolderSummary = { id: string; name: string; parentFolderId: string | null }

export function buildSidebarTree(folders: FolderSummary[], diagrams: DiagramEntry[]): SidebarData
export function isDescendant(folders: FolderSummary[], ancestorId: string, candidateId: string): boolean
```

`buildSidebarTree`: O(n) via Map. One pass to build nodeMap, one pass to assign diagrams, one pass to link children, filter root folders.

**Done when**:

- [ ] `buildSidebarTree` assembles nested tree from flat input correctly
- [ ] Root diagrams (no folderId) appear in `rootDiagrams`
- [ ] Root folders (no parentFolderId) appear in `folders`
- [ ] Nested folders appear as `children` of their parent
- [ ] `isDescendant(folders, 'A', 'B')` returns `true` if B is inside A's subtree
- [ ] `isDescendant` returns `false` for same id (self is not a descendant)
- [ ] Gate passes: `npm run lint && npm run test:unit`
- [ ] Test count: ≥ 8 unit tests pass (tree assembly cases + isDescendant cases)

**Tests**: unit
**Gate**: `npm run lint && npm run test:unit`

**Commit**: `feat(lib): add sidebar-tree utility for folder tree assembly`

---

### T3: Install @dnd-kit Dependencies [P]

**What**: Add `@dnd-kit/core` and `@dnd-kit/utilities` to project dependencies.
**Where**: `package.json`, `package-lock.json`
**Depends on**: None (can run alongside T1 and T2)
**Reuses**: N/A
**Requirements**: FOLD-11, FOLD-12, FOLD-13, FOLD-14, FOLD-15

**Done when**:

- [ ] `npm install @dnd-kit/core @dnd-kit/utilities` completed
- [ ] Both packages appear in `package.json` dependencies
- [ ] `npm run build` succeeds (no resolution errors)

**Tests**: none
**Gate**: `npm run build`

**Commit**: `chore(deps): add @dnd-kit/core and @dnd-kit/utilities`

---

### T4: lib/folders.ts — CRUD + Integration Tests

**What**: Server-side CRUD functions for `Folder` model, mirroring `lib/diagrams.ts` pattern. Includes integration tests against real test DB.
**Where**: `lib/folders.ts` (new), `tests/integration/api/folders.lib.integration.test.ts` (new)
**Depends on**: T1
**Reuses**: `lib/diagrams.ts` pattern exactly
**Requirements**: FOLD-01, FOLD-03, FOLD-08, FOLD-10

**Interfaces**:

```typescript
export type FolderSummary = { id: string; name: string; parentFolderId: string | null; updatedAt: Date }

export async function listFolders(userId: string): Promise<FolderSummary[]>
export async function createFolder(userId: string, name?: string, parentFolderId?: string | null): Promise<FolderSummary>
export async function updateFolder(id: string, userId: string, patch: { name?: string; parentFolderId?: string | null }): Promise<FolderSummary | null>
export async function deleteFolder(id: string, userId: string): Promise<boolean>
// deleteFolder moves diagrams + subfolders to root in ONE $transaction, then deletes
```

**Done when**:

- [ ] `listFolders` returns all folders for userId, ordered by `updatedAt desc`
- [ ] `createFolder` creates with default name `"New Folder"` if name omitted
- [ ] `updateFolder` returns null if folder not found or not owned by userId
- [ ] `deleteFolder` uses `db.$transaction` to: `updateMany diagrams folderId→null`, `updateMany subfolders parentFolderId→null`, then `deleteMany folder`
- [ ] `deleteFolder` returns `false` if folder not found or not owned
- [ ] Ownership enforced on all operations (userId filter)
- [ ] Integration tests cover: create, list, update name, update parentFolderId, delete (verifying diagrams moved to root)
- [ ] Gate passes: `npm run lint && npm run test:unit && npm run test:integration`
- [ ] Test count: ≥ 6 integration tests pass

**Tests**: integration
**Gate**: `npm run lint && npm run test:unit && npm run test:integration`

**Commit**: `feat(lib): add folders CRUD functions`

---

### T5: app/api/folders/route.ts — GET + POST + Integration Tests

**What**: New API route: `GET /api/folders` (list) and `POST /api/folders` (create), with auth + Zod validation.
**Where**: `app/api/folders/route.ts` (new), `tests/integration/api/folders.integration.test.ts` (new)
**Depends on**: T4
**Reuses**: Auth pattern + Zod pattern from `app/api/diagrams/route.ts` verbatim
**Requirements**: FOLD-03, FOLD-04

**Schemas**:

```typescript
const CreateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentFolderId: z.string().nullable().optional(),
})
```

**Done when**:

- [ ] `GET /api/folders` returns 401 if unauthenticated, 200 + `FolderSummary[]` if authenticated
- [ ] `POST /api/folders` returns 401 if unauthenticated, 400 on invalid body, 201 + `FolderSummary` on success
- [ ] `parentFolderId` accepted as nullable string (for creating nested folders directly)
- [ ] Integration tests cover: GET empty list, GET with folders, POST no name (uses default), POST with name, POST unauthenticated → 401, POST invalid body → 400
- [ ] Gate passes: `npm run lint && npm run test:unit && npm run test:integration`
- [ ] Test count: existing integration tests still pass + ≥ 6 new tests pass

**Tests**: integration
**Gate**: `npm run lint && npm run test:unit && npm run test:integration`

**Commit**: `feat(api): add GET and POST /api/folders`

---

### T6: app/api/folders/[id]/route.ts — PUT + DELETE + Integration Tests

**What**: New API route: `PUT /api/folders/[id]` (rename/move) and `DELETE /api/folders/[id]`. PUT validates circular reference server-side.
**Where**: `app/api/folders/[id]/route.ts` (new), `tests/integration/api/folders.integration.test.ts` (extend)
**Depends on**: T4, T5
**Reuses**: Auth + Zod + params pattern from `app/api/diagrams/[id]/route.ts`
**Requirements**: FOLD-08, FOLD-09, FOLD-10, FOLD-15, FOLD-16

**Schemas**:

```typescript
const UpdateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentFolderId: z.string().nullable().optional(),
}).refine((b) => b.name !== undefined || b.parentFolderId !== undefined, {
  message: "At least one of name or parentFolderId required",
})
```

**Circular ref validation** (PUT only): traverse `parentFolderId` chain from the new `parentFolderId` up to root. If any node equals `id` → return 422 `{ error: "Circular reference" }`.

**Done when**:

- [ ] `PUT /api/folders/[id]` returns 401 unauthenticated, 403 not found/not owned, 422 circular ref, 200 + updated `FolderSummary` on success
- [ ] `DELETE /api/folders/[id]` returns 401 unauthenticated, 403 not found/not owned, 200 `{}` on success
- [ ] DELETE verifies diagrams moved to root and subfolders moved to root (check via DB query in test)
- [ ] Circular ref: PUT folder A with `parentFolderId = A` → 422
- [ ] Circular ref: PUT folder A with `parentFolderId = B` where B is inside A → 422
- [ ] Integration tests cover all above cases
- [ ] Gate passes: `npm run lint && npm run test:unit && npm run test:integration`
- [ ] Test count: existing integration tests still pass + ≥ 8 new tests pass

**Tests**: integration
**Gate**: `npm run lint && npm run test:unit && npm run test:integration`

**Commit**: `feat(api): add PUT and DELETE /api/folders/[id]`

---

### T7: lib/diagrams.ts — Add folderId to updateDiagram + Integration Tests

**What**: Add `folderId?: string | null` to the `updateDiagram` patch type and Prisma update call. Update existing integration tests.
**Where**: `lib/diagrams.ts` (modify), `tests/integration/api/diagrams.integration.test.ts` (extend)
**Depends on**: T1
**Reuses**: Existing `updateDiagram` function
**Requirements**: FOLD-13, FOLD-14

**Change**:

```typescript
// Before
patch: { name?: string; data?: ExcalidrawState }

// After
patch: { name?: string; data?: ExcalidrawState; folderId?: string | null }
```

Prisma update data block adds: `...(patch.folderId !== undefined ? { folderId: patch.folderId } : {})`.

**Done when**:

- [ ] `updateDiagram` accepts `folderId` in patch and persists it
- [ ] `folderId: null` sets diagram to root (clears folder assignment)
- [ ] `folderId: undefined` (omitted) does NOT change existing folderId
- [ ] Integration test: update diagram folderId → verify persisted; update folderId to null → verify root
- [ ] Gate passes: `npm run lint && npm run test:unit && npm run test:integration`
- [ ] Test count: existing integration tests still pass + ≥ 2 new tests pass

**Tests**: integration
**Gate**: `npm run lint && npm run test:unit && npm run test:integration`

**Commit**: `feat(lib): add folderId to updateDiagram patch`

---

### T8: app/api/diagrams/[id]/route.ts — Add folderId to UpdateDiagramSchema + Integration Tests

**What**: Add `folderId: z.string().nullable().optional()` to `UpdateDiagramSchema` and pass it through to `updateDiagram`. Update integration tests.
**Where**: `app/api/diagrams/[id]/route.ts` (modify), `tests/integration/api/diagrams.integration.test.ts` (extend)
**Depends on**: T7
**Reuses**: Existing schema + handler
**Requirements**: FOLD-13, FOLD-14

**Schema change**:

```typescript
const UpdateDiagramSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  folderId: z.string().nullable().optional(),   // NEW
  data: z.object({ ... }).optional(),
}).refine((b) => b.name !== undefined || b.data !== undefined || b.folderId !== undefined, ...)
```

**Done when**:

- [ ] `PUT /api/diagrams/[id]` accepts `{ folderId: "abc" }` and updates diagram
- [ ] `PUT /api/diagrams/[id]` accepts `{ folderId: null }` and moves to root
- [ ] `folderId` alone (without name/data) satisfies the `refine` check
- [ ] Integration tests: move diagram to folder via API, move to root via API
- [ ] Gate passes: `npm run lint && npm run test:unit && npm run test:integration`
- [ ] Test count: existing integration tests still pass + ≥ 3 new tests pass

**Tests**: integration
**Gate**: `npm run lint && npm run test:unit && npm run test:integration`

**Commit**: `feat(api): add folderId to PUT /api/diagrams/[id]`

---

### T9: SidebarFolderItem Component + Unit Tests [P]

**What**: New client component — folder row with expand toggle, name display, rename mode, two-step delete confirm, and DnD draggable + droppable wiring.
**Where**: `components/sidebar/SidebarFolderItem.tsx` (new), `tests/unit/sidebar-folder-item.unit.test.tsx` (new)
**Depends on**: T2 (types from sidebar-tree), T3 (@dnd-kit installed)
**Reuses**: `ItemMode` state machine from `SidebarItem` (idle | renaming | delete-pending); hover-reveal button pattern; all class patterns from `SidebarItem`
**Requirements**: FOLD-01, FOLD-02, FOLD-05, FOLD-07, FOLD-08, FOLD-09

**Props**:

```typescript
type Props = {
  folder: FolderNode
  depth: number                          // indent level (0 = root)
  isExpanded: boolean
  onToggle: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  currentDiagramId: string
}
```

Folder row renders: `depth * 12px` left padding, chevron icon (▶/▼), folder name, rename button (hover), delete button (hover). When expanded, renders child `SidebarFolderItem`s + child `SidebarItem`s. Uses `useDraggable` and `useDroppable` from `@dnd-kit/core`.

**Done when**:

- [ ] Renders folder name with correct indent based on `depth`
- [ ] Chevron rotates on expand/collapse via `isExpanded`
- [ ] Clicking row calls `onToggle(id)`
- [ ] Hover reveals rename + delete buttons (same opacity pattern as `SidebarItem`)
- [ ] Rename mode: input prefilled, Enter commits, Escape cancels
- [ ] Delete: two-step confirm (3s timeout auto-cancel, same as `SidebarItem`)
- [ ] `useDraggable` applied with `data: { type: 'folder', id }`
- [ ] `useDroppable` applied with `data: { type: 'folder', id }`
- [ ] Child `SidebarFolderItem`s rendered when `isExpanded` + `folder.children.length > 0`
- [ ] Child `SidebarItem`s rendered when `isExpanded` + `folder.diagrams.length > 0`
- [ ] Gate passes: `npm run lint && npm run test:unit`
- [ ] Test count: ≥ 8 unit tests pass

**Tests**: unit
**Gate**: `npm run lint && npm run test:unit`

**Commit**: `feat(sidebar): add SidebarFolderItem component`

---

### T10: SidebarItem — Add Drag Handle + Unit Tests [P]

**What**: Extend existing `SidebarItem` with `useDraggable` from `@dnd-kit/core` and a visible drag handle icon. Update existing unit tests.
**Where**: `components/sidebar/SidebarItem.tsx` (modify), `tests/unit/sidebar.unit.test.tsx` (update)
**Depends on**: T3 (@dnd-kit installed)
**Reuses**: All existing `SidebarItem` logic unchanged
**Requirements**: FOLD-11

**Changes**:

- Add `useDraggable({ id, data: { type: 'diagram', id } })` hook
- Apply `listeners`, `attributes`, `setNodeRef` to the row div
- Add drag handle `⠿` icon (6-dot grid) visible on hover, `cursor-grab`
- `isDragging` → reduce opacity to 0.4

**Done when**:

- [ ] `useDraggable` wired: `setNodeRef`, `listeners`, `attributes` on row
- [ ] Drag handle icon visible on hover, hidden otherwise (same opacity pattern)
- [ ] `isDragging` state reduces item opacity
- [ ] Existing rename/delete behavior unchanged
- [ ] Existing unit tests still pass (update snapshots/assertions as needed)
- [ ] Gate passes: `npm run lint && npm run test:unit`
- [ ] Test count: existing sidebar tests still pass (no regressions)

**Tests**: unit
**Gate**: `npm run lint && npm run test:unit`

**Commit**: `feat(sidebar): add drag handle to SidebarItem`

---

### T11: DiagramPage — Add listFolders + buildSidebarTree + Update Prop

**What**: Update server component to fetch folders alongside diagrams, build the sidebar tree server-side, and pass `initialData: SidebarData` to `DiagramSidebar` instead of flat `diagrams[]`.
**Where**: `app/(app)/diagrams/[id]/page.tsx` (modify), `tests/unit/diagram-page.unit.test.tsx` (update or create)
**Depends on**: T2 (buildSidebarTree), T5 (listFolders), T6 (folder API stable), T8 (folderId in diagrams)
**Reuses**: Existing `Promise.all` pattern in `DiagramPage`
**Requirements**: FOLD-04

**Change**:

```typescript
import { listFolders } from "@/lib/folders"
import { buildSidebarTree, type SidebarData } from "@/lib/sidebar-tree"

const [diagram, diagrams, folders] = await Promise.all([
  getDiagramById(id, session!.user.id),
  listDiagrams(session!.user.id),
  listFolders(session!.user.id),
])

const sidebarData: SidebarData = buildSidebarTree(
  folders,
  diagrams.map((d) => ({ id: d.id, name: d.name, updatedAt: d.updatedAt.toISOString() }))
)

// Pass to sidebar:
<DiagramSidebar initialData={sidebarData} currentId={id} userName={userName} />
```

**Done when**:

- [ ] `listFolders` called in `Promise.all` alongside existing calls
- [ ] `buildSidebarTree` called with folders + serialized diagrams
- [ ] `DiagramSidebar` receives `initialData: SidebarData` prop (old `diagrams` prop removed)
- [ ] TypeScript compiles with no errors
- [ ] Unit test updated/created: renders without throwing, passes correct prop shape to sidebar
- [ ] Gate passes: `npm run lint && npm run test:unit`
- [ ] Test count: existing page tests still pass

**Tests**: unit
**Gate**: `npm run lint && npm run test:unit`

**Commit**: `feat(page): pass folder tree to DiagramSidebar`

---

### T12: DiagramSidebar Refactor — Tree State + DnD + Folder Handlers + E2E

**What**: Full refactor of `DiagramSidebar` to: accept `initialData: SidebarData`, manage tree state (replace flat `items[]`), expand/collapse with localStorage, folder CRUD handlers (create/rename/delete), DnD via `DndContext` + `DragOverlay`, `onDragEnd` handler with optimistic tree updates. Update unit tests + E2E.
**Where**: `components/sidebar/DiagramSidebar.tsx` (refactor), `tests/unit/sidebar.unit.test.tsx` (update), `tests/e2e/sidebar.spec.ts` (extend)
**Depends on**: T9 (SidebarFolderItem), T10 (SidebarItem drag handle), T11 (DiagramPage prop change)
**Reuses**: All existing collapse/resize/width localStorage patterns; `handleCreate` + `handleRename` + `handleDelete` patterns for diagrams (keep unchanged); optimistic update rollback pattern
**Requirements**: FOLD-01, FOLD-02, FOLD-04, FOLD-05, FOLD-06, FOLD-07, FOLD-08, FOLD-09, FOLD-10, FOLD-11, FOLD-12, FOLD-13, FOLD-14, FOLD-15, FOLD-16

**New state**:

```typescript
const [tree, setTree] = useState<SidebarData>(initialData)
const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
// localStorage key: "schemr:sidebar:expanded" (JSON array of ids)
```

**New handlers**:

- `handleFolderCreate()` — POST `/api/folders`, optimistic prepend to `tree.folders`; Escape rolls back
- `handleFolderRename(id, name)` — PUT `/api/folders/[id]`, optimistic name update
- `handleFolderDelete(id)` — DELETE `/api/folders/[id]`, optimistic remove from tree; on success move folder's diagrams to `tree.rootDiagrams`
- `handleMove(activeId, activeType, overId, overType)` — called from `onDragEnd`; validates with `isDescendant` before calling API; optimistic tree mutation; rollback on failure

**DnD wiring**:

```tsx
<DndContext onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
  {/* folder rows + diagram rows */}
  <DragOverlay>{activeItem && <span>{activeItem.name}</span>}</DragOverlay>
</DndContext>
```

Auto-expand on hover: `handleDragOver` sets a `setTimeout(600ms)` per folder id; cleared on different folder or drag end.

**Root drop zone**: a `useDroppable({ id: 'root', data: { type: 'root' } })` div at bottom of list. Drop here → `folderId: null` or `parentFolderId: null`.

**Done when**:

- [ ] Sidebar renders folder tree above root diagrams
- [ ] Folders collapse/expand; state saved to localStorage
- [ ] "New folder" button in header creates folder with optimistic entry + immediate rename mode
- [ ] Rename folder: hover → button → input → Enter saves, Escape reverts
- [ ] Delete folder: two-step confirm; diagrams appear at root after delete
- [ ] Drag diagram onto folder: diagram moves under folder in sidebar; PUT `/api/diagrams/[id]` called
- [ ] Drag diagram to root drop zone: diagram moves to rootDiagrams; `folderId: null` sent
- [ ] Drag folder onto folder: `isDescendant` check; PUT `/api/folders/[id]` called
- [ ] Drag folder to root: `parentFolderId: null` sent
- [ ] Circular drag rejected silently (item snaps back); no API call made
- [ ] Auto-expand: hovering dragged item over collapsed folder for 600ms expands it
- [ ] DragOverlay shows dragged item name
- [ ] Failed API calls roll back tree to pre-action state
- [ ] Existing diagram create/rename/delete still works
- [ ] E2E tests cover: create folder, rename folder, delete folder + verify diagrams at root, drag diagram into folder, nested folder (drag A into B)
- [ ] Gate passes: `npm run lint && npm run test:unit && npm run test:integration && npm run test:e2e`
- [ ] Test count: existing sidebar tests updated + ≥ 5 new E2E scenarios pass

**Tests**: unit + e2e
**Gate**: `npm run lint && npm run test:unit && npm run test:integration && npm run test:e2e`

**Commit**: `feat(sidebar): implement folder tree, DnD, and folder management`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1

Phase 2 (Parallel — after T1):
  T1 complete, then:
    ├── T2 [P]  lib/sidebar-tree.ts
    └── T3 [P]  install @dnd-kit

Phase 3 (Sequential — integration tests, after T1):
  T1 complete, then:
    T4 → T5 → T6 → T7 → T8
  (runs sequentially alongside / after Phase 2)

Phase 4 (Parallel — after T2 + T3 complete):
    ├── T9 [P]  SidebarFolderItem
    └── T10 [P] SidebarItem drag handle

Phase 5 (Sequential — after T5 + T6 + T8 + T2 complete):
    T11  DiagramPage update

Phase 6 (Sequential — E2E, after T9 + T10 + T11 complete):
    T12  DiagramSidebar refactor + E2E
```

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: Prisma schema | 1 file (schema) + migration | ✅ Granular |
| T2: lib/sidebar-tree.ts | 1 new file (pure utility) | ✅ Granular |
| T3: Install @dnd-kit | 1 package.json change | ✅ Granular |
| T4: lib/folders.ts | 1 new lib file + integration tests | ✅ Granular |
| T5: api/folders/route.ts | 1 new route (2 HTTP methods) + tests | ✅ Granular |
| T6: api/folders/[id]/route.ts | 1 new route (2 HTTP methods) + tests | ✅ Granular |
| T7: lib/diagrams.ts update | 1 function patch in 1 file | ✅ Granular |
| T8: api/diagrams/[id] update | 1 schema field + pass-through | ✅ Granular |
| T9: SidebarFolderItem | 1 new component | ✅ Granular |
| T10: SidebarItem drag handle | 1 component modification | ✅ Granular |
| T11: DiagramPage update | 1 server component (3 line change) | ✅ Granular |
| T12: DiagramSidebar refactor | 1 component (large but single file) + E2E | ⚠️ Large but cohesive — cannot split without incomplete intermediate states |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Start of all chains | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | Parallel with T1 (T3 is @dnd-kit install, no code dep) | ✅ Match |
| T4 | T1 | T1 → T4 → T5 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T4, T5 | T5 → T6 | ✅ Match |
| T7 | T1 | T6 → T7 (sequential integration chain ordering) | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T2, T3 | T2+T3 done → T9 [P] | ✅ Match |
| T10 | T3 | T3 done → T10 [P] | ✅ Match |
| T11 | T2, T5, T6, T8 | T5+T6+T8+T2 done → T11 | ✅ Match |
| T12 | T9, T10, T11 | T9+T10+T11 done → T12 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1: Prisma schema | DB schema (no query logic) | none (tested via integration suites) | none | ✅ OK |
| T2: lib/sidebar-tree.ts | Utility function `lib/**` | unit | unit | ✅ OK |
| T3: Install @dnd-kit | package.json | none | none | ✅ OK |
| T4: lib/folders.ts | Prisma queries / DB access | integration | integration | ✅ OK |
| T5: api/folders/route.ts | API route `app/api/**` | integration | integration | ✅ OK |
| T6: api/folders/[id]/route.ts | API route `app/api/**` | integration | integration | ✅ OK |
| T7: lib/diagrams.ts | Prisma queries / DB access | integration | integration | ✅ OK |
| T8: api/diagrams/[id]/route.ts | API route `app/api/**` | integration | integration | ✅ OK |
| T9: SidebarFolderItem | React component `app/**` | unit + E2E | unit (E2E in T12) | ⚠️ E2E deferred to T12 — justified: component cannot be E2E tested until DiagramSidebar wires it in T12 |
| T10: SidebarItem | React component `app/**` | unit + E2E | unit (E2E in T12) | ⚠️ E2E deferred to T12 — same justification |
| T11: DiagramPage | React component `app/**` | unit + E2E | unit (E2E in T12) | ⚠️ E2E deferred to T12 — isolated server component; full E2E requires T12 complete |
| T12: DiagramSidebar | React component + E2E flows | unit + E2E | unit + e2e | ✅ OK — absorbs E2E for T9, T10, T11 (merge-forward resolution) |
