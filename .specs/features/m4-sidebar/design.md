# M4 — Editor Sidebar Design

**Spec**: `.specs/features/m4-sidebar/spec.md`
**Status**: Draft

---

## Architecture Overview

M4 restructures the editor page from a full-screen canvas into a flex-row split: sidebar on the left, canvas on the right. The sidebar width is resizable with a drag handle. The server component fetches both the current diagram and the full list in a single render, passing them as props to the client sidebar — no loading flicker.

```
app/(app)/diagrams/[id]/page.tsx  (Server Component)
  │
  ├── requireSession() → userId
  ├── getDiagramById(id, userId)     ─┐ parallel
  ├── listDiagrams(userId)           ─┘
  │
  └── renders:
      <div class="flex h-screen w-screen">
        <DiagramSidebar
          diagrams={diagrams}
          currentId={id}
        />
        <main class="flex-1 overflow-hidden">
          <ExcalidrawEditor initialData={diagram.data} diagramId={id} />
        </main>
      </div>
```

**`app/(app)/page.tsx`** (reworked):
```
requireSession() → userId
listDiagrams(userId) → take first (most recent, ordered by updatedAt desc)
  if found  → redirect(/diagrams/:id)
  if empty  → render <NodiagramsLanding />
```

---

## Components

### `DiagramSidebar` — `components/sidebar/DiagramSidebar.tsx`

Client component. Owns collapse state, width state, and diagram list mutations.

**Props**:
```typescript
type Props = {
  diagrams: Array<{ id: string; name: string; updatedAt: string }>
  currentId: string
}
```

**Local state**:
```typescript
// SSR defaults — server always renders expanded at 220px
const [collapsed, setCollapsed] = useState(false)
const [width, setWidth] = useState(220)
const [items, setItems] = useState(props.diagrams)
const [creating, setCreating] = useState(false)

// Hydrate from localStorage after mount — avoids SSR/client mismatch
// Trade-off: user with a saved collapsed/width preference sees a brief
// layout adjustment on first paint. Acceptable for MVP; a cookie-based
// approach (server-readable) would eliminate the flash but adds complexity.
useEffect(() => {
  const storedCollapsed = localStorage.getItem('schemr:sidebar:collapsed')
  if (storedCollapsed !== null) setCollapsed(storedCollapsed === 'true')
  const storedWidth = localStorage.getItem('schemr:sidebar:width')
  if (storedWidth !== null) setWidth(Number(storedWidth))
}, [])
```

**Collapsed state**: when `collapsed === true`, the sidebar renders as a narrow strip (~40px) with only the toggle button — no list, no labels, no actions. The `<main>` canvas fills the remaining space via `flex-1`.

**Width**: applied as `style={{ width }}` on the sidebar container when expanded. The drag handle (right edge) updates `width` on `mousemove`, clamped to `[180, Infinity]`. Persisted to `localStorage` on `mouseup`.

**Ordering invariant**: `items` is always kept in `updatedAt` descending order — the same order returned by `listDiagrams`. Mutations preserve this:
- `handleCreate`: new diagram is prepended (`[newItem, ...items]`) — it is the most recent by definition
- `handleRename`: replaces name in-place, does not change order (rename does not update `updatedAt` in the DB — only `data` changes do via PUT)
- `handleDelete`: removes item by id. To find "most recent remaining" for navigation, take the first item in `items` after removal (index 0 if the deleted item was not index 0, or index 0 of the shorter list otherwise). The list is ordered, so index 0 is always the most recent.

**Mutations** (optimistic pattern):
- `handleCreate`: POST → prepend to `items` → `router.push(/diagrams/:id)`; revert on failure
- `handleRename(id, name)`: replace name in-place in `items` → PUT → revert on failure
- `handleDelete(id)`:
  1. Compute `nextId`: if `id === currentId`, find first item in `items` where `item.id !== id`; if none, navigate to `/`
  2. Remove item from `items`
  3. Call `DELETE /api/diagrams/:id`
  4. On success: if `id === currentId`, `router.push(/diagrams/${nextId})` or `/`
  5. On failure: re-insert item at original index, do not navigate

**Layout (expanded)**:
```
┌─────────────────────┐
│ [←] Schemr    [+]   │  ← header: toggle + title + new diagram button
├─────────────────────┤
│ ▶ My Diagram        │  ← current diagram (highlighted)
│   Another one       │
│   Third diagram     │
│   ...               │
├─────────────────────┤  drag handle (right edge, invisible until hover)
```

**Layout (collapsed)**:
```
┌────┐
│ [→]│  ← toggle only
│    │
│    │
```

---

### `SidebarItem` — `components/sidebar/SidebarItem.tsx`

Client component. Manages its own rename mode and delete pending state.

**Props**:
```typescript
type Props = {
  id: string
  name: string
  isCurrent: boolean
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}
```

**Local state**:
```typescript
type ItemMode = 'idle' | 'renaming' | 'delete-pending'
const [mode, setMode] = useState<ItemMode>('idle')
const [editValue, setEditValue] = useState(name)
```

**Idle mode**:
- Entire row clickable → `router.push(/diagrams/:id)` (unless `isCurrent`)
- On hover: edit icon + delete icon appear
- `isCurrent`: highlighted background, non-clickable (clicking does nothing)

**Rename mode** (triggered by edit icon click):
- Input pre-filled with name
- Enter: validate (non-blank, changed) → `onRename(id, trimmed)` → back to idle
- Escape / blur: restore original, back to idle

**Delete pending** (triggered by first click on delete icon):
- Icon turns red; tooltip appears: "Click again to delete"
- Second click on icon → `onDelete(id)` → back to idle
- Click anywhere else → `mousedown` outside handler cancels → back to idle

**Delete pending timeout**: auto-cancel after 3 seconds if no second click (prevents confused UI state if user moves mouse away).

---

### `NoDiagramsLanding` — inline in `app/(app)/page.tsx`

Simple server-rendered component for the empty state at `/`. Not a separate file — small enough to live inline.

```typescript
// Inline in page.tsx when diagrams.length === 0
<main className="min-h-screen bg-zinc-950 flex items-center justify-center">
  <div className="flex flex-col items-center gap-4 text-center">
    <p className="text-zinc-400 text-sm">No diagrams yet.</p>
    <CreateFirstDiagramButton />  {/* client component — calls POST */}
  </div>
</main>
```

`CreateFirstDiagramButton` is a small client component (POST + router.push) — also inline in page.tsx or a tiny separate file.

---

## Resize Handle Implementation

The drag handle lives on the right edge of the sidebar. Resize is implemented with `mousedown`/`mousemove`/`mouseup` on `document` (not on the element itself, so fast drags don't lose track):

```typescript
function startResize(e: React.MouseEvent) {
  const startX = e.clientX
  const startWidth = width

  function onMove(e: MouseEvent) {
    const next = Math.max(180, startWidth + (e.clientX - startX))
    setWidth(next)
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    localStorage.setItem('schemr:sidebar:width', String(width))
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
```

The handle is a `4px` wide invisible div on the right edge with `cursor-col-resize`. On hover it shows a subtle visual indicator.

**Note**: `width` in `onUp` captures a stale closure — use a `ref` to track the latest width for the localStorage write:
```typescript
const widthRef = useRef(width)
useEffect(() => { widthRef.current = width }, [width])
// then in onUp: localStorage.setItem('schemr:sidebar:width', String(widthRef.current))
```

---

## `app/(app)/diagrams/[id]/page.tsx` — Updated

Fetches diagram list and current diagram in parallel:

```typescript
export default async function DiagramPage({ params }) {
  const { id } = await params
  const session = await requireSession()

  const [diagram, diagrams] = await Promise.all([
    getDiagramById(id, session.user.id),
    listDiagrams(session.user.id),
  ])

  if (!diagram) notFound()

  const serialized = diagrams.map(d => ({
    id: d.id,
    name: d.name,
    updatedAt: d.updatedAt.toISOString(),
  }))

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <DiagramSidebar diagrams={serialized} currentId={id} />
      <main className="flex-1 overflow-hidden">
        <ExcalidrawEditor initialData={diagram.data} diagramId={id} />
      </main>
    </div>
  )
}
```

---

## `app/(app)/page.tsx` — Reworked

```typescript
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { listDiagrams } from '@/lib/diagrams'

export default async function IndexPage() {
  const session = await requireSession()
  const diagrams = await listDiagrams(session.user.id)

  if (diagrams.length > 0) {
    redirect(`/diagrams/${diagrams[0].id}`)
  }

  return <NoDiagramsLanding />  // + CreateFirstDiagramButton inline
}
```

`listDiagrams` already returns results ordered by `updatedAt` desc — `diagrams[0]` is always the most recent.

---

## localStorage Keys

| Key | Value | Description |
|---|---|---|
| `schemr:sidebar:collapsed` | `"true"` / `"false"` | Sidebar expand/collapse state |
| `schemr:sidebar:width` | `"220"` (number as string) | Sidebar width in px |

Read in a `useEffect` on mount (see `DiagramSidebar` state section above). SSR always renders with defaults (expanded, 220px); client adjusts after hydration.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Create fails | Re-enable "+" button, show error indicator in sidebar header |
| Rename fails | Revert name in list |
| Delete fails | Re-insert item in list |
| Delete current diagram → navigate → new diagram 404 | Fallback to `/` (no diagrams remaining) |
| localStorage unavailable (SSR, private browsing) | Default to expanded, 220px — graceful degradation |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Parallel data fetch | `Promise.all([getDiagramById, listDiagrams])` | Adds ~0ms latency vs serial; list is free since session is already validated |
| Width persistence | `localStorage` (not URL, not server) | Pure client preference; no round-trip needed |
| Resize via document events | `mousemove` / `mouseup` on document | Prevents losing drag on fast mouse movement outside the handle |
| `widthRef` for localStorage write | `useRef` synced to `width` | Avoids stale closure in `onUp` — `width` state is not accessible inside the document event handler otherwise |
| Hydration strategy | `useState(default)` + `useEffect` reads localStorage | Avoids SSR/client mismatch; trade-off is a brief layout adjustment on first paint for users with saved preferences |
| Delete pending timeout | 3s auto-cancel | Prevents stale red icon state if user moves mouse away without clicking |
| "Most recent remaining" after delete | First item in `items` after removal (list is ordered `updatedAt` desc) | Order is set at load and maintained by invariant — index 0 is always the most recent without re-sorting |
| `NoDiagramsLanding` inline | In `page.tsx`, not a separate file | Too small to justify its own file |
| No sidebar on `/` | `/` redirects or shows landing — no sidebar | Sidebar requires a `currentId`; landing has no active diagram |
| M3 components not deleted | Left in place, no formal task | Rollout caution — remove in a cleanup pass once M4 is stable in production |
