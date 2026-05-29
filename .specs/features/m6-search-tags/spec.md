# Search + Tags Specification

## Problem Statement

As the diagram count grows, users lose the ability to find a specific diagram quickly. The sidebar lists
everything in recency order with no way to narrow it down. Tags address the same problem from a different
angle: instead of recalling the name, users can group diagrams by topic (e.g. "infra", "onboarding",
"sprint-42") and jump straight to that group. Search and tags together cover both retrieval modes —
recall by name and browse by category.

## Goals

- [ ] User can locate any diagram by typing part of its name — result appears within the same render cycle (no network call).
- [ ] User can tag diagrams and filter the sidebar to only show diagrams with a given tag.
- [ ] Search and tag filter compose: both active at the same time narrows results further.

## Out of Scope

| Feature | Reason |
|---|---|
| Search inside diagram content (element labels, text) | Requires indexing Excalidraw JSON — separate feature |
| Tag colors / icons | Cosmetic, deferred |
| Shared / global tags across users | Out of scope for personal workspace |
| Bulk tagging (select multiple diagrams → apply tag) | Deferred |
| Tag renaming | Deferred — delete + recreate covers the need for now |

---

## User Stories

### P1: Search diagrams by name ⭐ MVP

**User Story**: As a user, I want to type in the sidebar and see only matching diagrams so that I can find a diagram without scrolling.

**Why P1**: Zero backend work, immediate value for any user with more than ~10 diagrams.

**Acceptance Criteria**:

1. WHEN the sidebar is expanded THEN system SHALL display a search input above the diagram/folder list.
2. WHEN user types in the search input THEN system SHALL filter the sidebar in real-time (client-side) to show only diagrams whose name contains the query (case-insensitive).
3. WHEN a query is active THEN system SHALL flatten the folder tree and show all matching diagrams regardless of which folder they are in.
4. WHEN no diagrams match the query THEN system SHALL display an empty state message ("No diagrams match").
5. WHEN user clears the search input THEN system SHALL restore the full folder tree view.
6. WHEN the sidebar is collapsed THEN system SHALL hide the search input.

**Independent Test**: Type a partial name that matches 2 of 5 diagrams → sidebar shows exactly those 2, no folders.

---

### P1: Create and delete tags ⭐ MVP

**User Story**: As a user, I want to create named tags and delete ones I no longer need so that I can manage my own tag vocabulary.

**Why P1**: Tags are useless without CRUD. Creating tags is the foundation all other tag stories depend on.

**Acceptance Criteria**:

1. WHEN user opens the tag manager (accessible from the sidebar header) THEN system SHALL show the list of all existing tags for the user.
2. WHEN user submits a new tag name THEN system SHALL create the tag via `POST /api/tags` and add it to the list.
3. WHEN a tag name is empty or whitespace-only THEN system SHALL reject creation and show an inline error.
4. WHEN a tag with the same name already exists for the user THEN system SHALL reject creation with an error ("Tag already exists").
5. WHEN user deletes a tag THEN system SHALL remove it via `DELETE /api/tags/:id` and remove it from all diagrams it was applied to.
6. WHEN user deletes a tag THEN system SHALL ask for confirmation before proceeding.

**Independent Test**: Create tag "infra" → appears in list. Create duplicate "infra" → error shown. Delete "infra" → gone from list.

---

### P1: Assign and remove tags on a diagram ⭐ MVP

**User Story**: As a user, I want to assign tags to the diagram I am editing so that I can categorize it.

**Why P1**: Tags without assignment have no value. Needs to be discoverable inline while editing.

**Acceptance Criteria**:

1. WHEN user is editing a diagram THEN system SHALL display a tag section in the sidebar item for the current diagram (or a dedicated panel accessible from the editor).
2. WHEN user clicks "Add tag" on a diagram THEN system SHALL show a dropdown/list of existing tags to pick from.
3. WHEN user selects a tag THEN system SHALL assign it to the diagram via `POST /api/diagrams/:id/tags/:tagId` and reflect it immediately in the UI.
4. WHEN a diagram has tags assigned THEN system SHALL display tag chips on the sidebar item.
5. WHEN user removes a tag chip from a diagram THEN system SHALL detach it via `DELETE /api/diagrams/:id/tags/:tagId` and remove the chip immediately.
6. WHEN no tags exist yet THEN system SHALL show "Create a tag first" with a link to the tag manager.

**Independent Test**: Assign tag "infra" to a diagram → chip appears on sidebar item. Remove chip → chip disappears.

---

### P1: Filter sidebar by tag ⭐ MVP

**User Story**: As a user, I want to click a tag in the sidebar and see only diagrams with that tag so that I can browse by category.

**Why P1**: The primary retrieval value of tags — without filtering they are just decorative labels.

**Acceptance Criteria**:

1. WHEN user selects a tag filter in the sidebar THEN system SHALL show only diagrams assigned to that tag, flattened (no folder grouping while filter is active).
2. WHEN a tag filter is active THEN system SHALL highlight the active tag visually.
3. WHEN user deselects the active tag filter THEN system SHALL restore the full folder tree.
4. WHEN a tag filter is active and no diagrams match THEN system SHALL show an empty state ("No diagrams tagged with [tag name]").
5. WHEN both a tag filter and a search query are active THEN system SHALL show only diagrams matching BOTH conditions (intersection).

**Independent Test**: Tag 3 of 5 diagrams with "infra" → click "infra" filter → sidebar shows exactly 3 diagrams.

---

### P2: Create tag inline while assigning

**User Story**: As a user, I want to type a new tag name in the tag picker and create it on the fly so that I don't have to open the tag manager separately.

**Why P2**: Reduces friction, but the P1 flow (create in manager, then assign) covers the need.

**Acceptance Criteria**:

1. WHEN user types in the tag picker and the text does not match any existing tag THEN system SHALL show a "Create '[name]'" option at the bottom of the dropdown.
2. WHEN user selects "Create '[name]'" THEN system SHALL create the tag and immediately assign it to the diagram in a single flow.

**Independent Test**: Open tag picker on a diagram, type "new-tag" → "Create 'new-tag'" option appears → select it → tag created and assigned.

---

### P2: Tag chips visible on sidebar items (non-current diagrams)

**User Story**: As a user, I want to see tag chips on sidebar items while browsing so that I know what each diagram is about at a glance.

**Why P2**: Useful but adds visual density. P1 chip on the current diagram covers the main need.

**Acceptance Criteria**:

1. WHEN a diagram in the sidebar list has tags THEN system SHALL show up to 2 tag chips on its sidebar item (truncated with "+N more" if more than 2).
2. WHEN the sidebar is narrow THEN system SHALL hide tag chips to avoid overflow (chips appear on hover only).

---

## Edge Cases

- WHEN search query matches a diagram inside a nested folder THEN system SHALL show it at root level (flattened) with a folder breadcrumb indicator.
- WHEN all diagrams are filtered out (search + tag) THEN system SHALL show a single empty state, not separate ones.
- WHEN user navigates to a diagram that is filtered out by active tag/search THEN system SHALL keep the filter active but highlight the current diagram regardless.
- WHEN tag name exceeds 32 characters THEN system SHALL reject creation with an error.
- WHEN a diagram is deleted while a tag filter is active THEN system SHALL remove it from the filtered list immediately.

---

## Data Model

```
Tag
  id          String   @id @default(cuid())
  name        String
  userId      String
  user        User     @relation(...)
  diagrams    DiagramTag[]
  createdAt   DateTime @default(now())

  @@unique([userId, name])
  @@index([userId])

DiagramTag (join table)
  diagramId   String
  tagId       String
  diagram     Diagram  @relation(...)
  tag         Tag      @relation(...)
  assignedAt  DateTime @default(now())

  @@id([diagramId, tagId])
```

New API endpoints:
- `GET  /api/tags`                       — list user's tags
- `POST /api/tags`                       — create tag (`{ name }`)
- `DELETE /api/tags/:id`                 — delete tag + cascade detach from diagrams
- `POST /api/diagrams/:id/tags/:tagId`   — assign tag to diagram
- `DELETE /api/diagrams/:id/tags/:tagId` — remove tag from diagram

`listDiagrams` expands to include `tags: { id, name }[]` per diagram.

---

## Requirement Traceability

| Requirement ID | Story | Status |
|---|---|---|
| SRCH-01 | P1: Search — input visible in expanded sidebar | Pending |
| SRCH-02 | P1: Search — real-time client-side filter | Pending |
| SRCH-03 | P1: Search — flatten folder tree when query active | Pending |
| SRCH-04 | P1: Search — empty state when no match | Pending |
| SRCH-05 | P1: Search — restore tree on clear | Pending |
| TAG-01  | P1: Create tag via API | Pending |
| TAG-02  | P1: Delete tag + cascade | Pending |
| TAG-03  | P1: Duplicate name rejected | Pending |
| TAG-04  | P1: Assign tag to diagram | Pending |
| TAG-05  | P1: Remove tag from diagram | Pending |
| TAG-06  | P1: Tag chips on current diagram sidebar item | Pending |
| TAG-07  | P1: Filter sidebar by tag (flatten) | Pending |
| TAG-08  | P1: Active tag filter highlighted | Pending |
| TAG-09  | P1: Search + tag filter compose (intersection) | Pending |
| TAG-10  | P2: Inline tag creation in picker | Pending |
| TAG-11  | P2: Tag chips on non-current sidebar items | Pending |

**Coverage:** 16 total, 0 mapped to tasks, 16 unmapped ⚠️

---

## Success Criteria

- [ ] User can find any diagram by name in ≤ 2 keystrokes without scrolling.
- [ ] User can filter to a topic group (tag) in 1 click.
- [ ] Search + tag filter compose correctly — no UI glitch when both active simultaneously.
- [ ] Zero network calls triggered by search input (pure client-side).
- [ ] Tag CRUD operations complete in < 500ms (network-bound, single DB call each).
