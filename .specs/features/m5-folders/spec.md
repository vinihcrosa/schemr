# Folders Feature Specification

## Problem Statement

Diagrams are currently displayed as a flat list in the sidebar. As users create more diagrams, there is no way to group or organize them — everything lives at the "root" level. This makes it hard to manage large collections of diagrams by project, team, or topic.

## Goals

- [ ] Users can create named folders and place diagrams inside them
- [ ] Diagrams not assigned to any folder appear at the root level (existing behavior preserved)
- [ ] Users can rename folders
- [ ] Users can drag diagrams into folders via the sidebar
- [ ] Users can nest folders inside other folders (drag folder into folder)

## Out of Scope

| Feature | Reason |
|---|---|
| Sharing folders with other users | Sharing not in product yet |
| Folder-level permissions | No multi-user collaboration yet |
| Bulk move (select multiple diagrams) | Separate UX concern |
| Search/filter within a folder | Separate feature |
| Folder icons or colors | Nice-to-have, deferred |
| Delete folder with cascade delete of diagrams | Risk of data loss — folders delete to root only |

---

## User Stories

### P1: Create Folder ⭐ MVP

**User Story**: As a user, I want to create a named folder in the sidebar so that I can organize my diagrams.

**Why P1**: Without the ability to create folders, the feature doesn't exist. Entry point for all other stories.

**Acceptance Criteria**:

1. WHEN user clicks "New folder" action in sidebar header THEN system SHALL create a folder with a default name and immediately enter rename mode
2. WHEN user types a name and presses Enter THEN system SHALL save the folder with that name
3. WHEN user presses Escape during naming THEN system SHALL discard the new folder (optimistic rollback)
4. WHEN folder is created THEN system SHALL display it in the sidebar above root-level diagrams, collapsed by default
5. WHEN folder name is empty on commit THEN system SHALL keep rename mode active and show inline validation

**Independent Test**: Create a folder via sidebar → it appears in the list with given name → refreshing persists it.

---

### P1: View Tree: Folders + Root Diagrams ⭐ MVP

**User Story**: As a user, I want to see my diagrams organized by folder in the sidebar so that I can navigate them easily.

**Why P1**: Organizing diagrams is the core value. Users need to see the structure.

**Acceptance Criteria**:

1. WHEN sidebar loads THEN system SHALL display folders before root-level diagrams
2. WHEN a folder is collapsed THEN system SHALL show only the folder row, hiding its children
3. WHEN a folder is expanded THEN system SHALL show diagram children indented beneath it
4. WHEN a diagram has no folder THEN system SHALL display it at root level after all folders
5. WHEN a folder has no diagrams THEN system SHALL still display the folder (empty state)
6. WHEN user clicks folder row THEN system SHALL toggle collapsed/expanded state
7. WHEN sidebar is re-mounted THEN system SHALL restore each folder's collapsed/expanded state from localStorage

**Independent Test**: Create folder, move a diagram into it (via API), reload sidebar → folder shows with diagram nested inside.

---

### P1: Rename Folder ⭐ MVP

**User Story**: As a user, I want to rename a folder so that I can correct names or reorganize labels.

**Why P1**: Rename is a basic CRUD operation. Creating with wrong name and having no fix is poor UX.

**Acceptance Criteria**:

1. WHEN user hovers over folder row THEN system SHALL reveal a rename icon button
2. WHEN user clicks rename icon THEN system SHALL replace folder name with an editable input prefilled with current name
3. WHEN user presses Enter THEN system SHALL save the new name optimistically and persist via API
4. WHEN user presses Escape or blurs input THEN system SHALL revert to previous name
5. WHEN API call fails THEN system SHALL rollback to previous name and show error toast

**Independent Test**: Rename a folder → new name appears immediately → refresh page → name persists.

---

### P1: Delete Folder ⭐ MVP

**User Story**: As a user, I want to delete a folder so that I can remove unused groupings.

**Why P1**: Without delete, folder list grows without cleanup path.

**Acceptance Criteria**:

1. WHEN user hovers over folder row THEN system SHALL reveal a delete icon button
2. WHEN user clicks delete icon THEN system SHALL show a two-step confirm (same UX as diagram delete)
3. WHEN user confirms delete THEN system SHALL delete the folder and move all its diagrams to root (no cascade delete of diagrams)
4. WHEN user confirms delete THEN system SHALL also move any nested subfolders to root level
5. WHEN API call fails THEN system SHALL restore the folder and show error toast

**Independent Test**: Create folder with 2 diagrams → delete folder → diagrams appear at root.

---

### P1: Drag Diagram Into Folder ⭐ MVP

**User Story**: As a user, I want to drag a diagram into a folder so that I can organize without menus.

**Why P1**: Drag-and-drop is the primary interaction model for organizing — no alternative move mechanism exists.

**Acceptance Criteria**:

1. WHEN user starts dragging a diagram item in sidebar THEN system SHALL show a drag ghost and highlight valid drop targets (folders)
2. WHEN user drags over a collapsed folder THEN system SHALL auto-expand the folder after 600ms hover
3. WHEN user drops diagram onto a folder THEN system SHALL move diagram into that folder optimistically and persist via API
4. WHEN user drops diagram onto the root area (below all folders) THEN system SHALL move diagram to root (folderId = null)
5. WHEN drag is cancelled (Escape or drop outside valid target) THEN system SHALL restore original position
6. WHEN API call fails THEN system SHALL rollback to original position and show error toast

**Independent Test**: Drag diagram from root onto folder → diagram disappears from root, appears nested under folder.

---

### P1: Drag Folder Into Another Folder (Nested Folders) ⭐ MVP

**User Story**: As a user, I want to drag a folder inside another folder so that I can create hierarchical organization.

**Why P1**: Nesting is part of the core folder model — unlimited depth required from the start.

**Acceptance Criteria**:

1. WHEN user drags a folder THEN system SHALL allow dropping onto another folder (not onto itself or its own descendants)
2. WHEN user drops folder A into folder B THEN system SHALL set folder A's parentFolderId = folder B's id
3. WHEN user drops folder onto root area THEN system SHALL set parentFolderId = null
4. WHEN folder has a parent THEN system SHALL render it indented under its parent in the sidebar (unlimited depth, indented per level)
5. WHEN a folder would create a circular reference (dragging parent into its own child) THEN system SHALL reject the drop and show visual feedback

**Independent Test**: Create two folders → drag folder A into folder B → sidebar shows B expanded with A nested inside.

---

## Edge Cases

- WHEN user tries to create folder and has no internet THEN system SHALL show error and remove optimistic entry
- WHEN folder name exceeds 255 characters THEN system SHALL truncate input at 255 and show validation
- WHEN diagram is currently open and gets moved to a folder THEN system SHALL NOT navigate away or reload the editor
- WHEN user deletes a folder while a child diagram is open THEN system SHALL keep the editor open; diagram moves to root
- WHEN sidebar has many deeply nested items THEN system SHALL maintain scroll position after drag-drop
- WHEN two folders have the same name THEN system SHALL allow it (no uniqueness constraint — names are labels, not IDs)

---

## Data Model Changes

### New: `Folder` model

```prisma
model Folder {
  id             String    @id @default(cuid())
  name           String    @default("New Folder")
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  parentFolderId String?
  parent         Folder?   @relation("FolderChildren", fields: [parentFolderId], references: [id])
  children       Folder[]  @relation("FolderChildren")
  diagrams       Diagram[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([userId])
}
```

### Updated: `Diagram` model

```prisma
model Diagram {
  // ... existing fields ...
  folderId  String?
  folder    Folder?  @relation(fields: [folderId], references: [id])
}
```

### New API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/folders` | List all folders for current user (with children/diagrams) |
| POST | `/api/folders` | Create folder |
| PUT | `/api/folders/[id]` | Update folder (name, parentFolderId) |
| DELETE | `/api/folders/[id]` | Delete folder (moves children to root) |
| PUT | `/api/diagrams/[id]` | Existing — add `folderId` to patch schema |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| FOLD-01 | P1: Create Folder — create action in sidebar | Design | Pending |
| FOLD-02 | P1: Create Folder — enter rename mode on create | Design | Pending |
| FOLD-03 | P1: Create Folder — persist via POST /api/folders | Design | Pending |
| FOLD-04 | P1: View Tree — folders listed before root diagrams | Design | Pending |
| FOLD-05 | P1: View Tree — collapsed/expanded toggle | Design | Pending |
| FOLD-06 | P1: View Tree — localStorage persistence for expand state | Design | Pending |
| FOLD-07 | P1: Rename Folder — hover reveals rename button | Design | Pending |
| FOLD-08 | P1: Rename Folder — optimistic update + API persist | Design | Pending |
| FOLD-09 | P1: Delete Folder — two-step confirm | Design | Pending |
| FOLD-10 | P1: Delete Folder — children move to root (no cascade) | Design | Pending |
| FOLD-11 | P1: Drag Diagram — drag ghost + drop target highlights | Design | Pending |
| FOLD-12 | P1: Drag Diagram — auto-expand on hover | Design | Pending |
| FOLD-13 | P1: Drag Diagram — optimistic move + API persist | Design | Pending |
| FOLD-14 | P1: Drag Diagram — drop to root (folderId = null) | Design | Pending |
| FOLD-15 | P1: Drag Folder — nested folder support (unlimited depth) | Design | Pending |
| FOLD-16 | P1: Drag Folder — circular reference prevention | Design | Pending |

**Coverage**: 16 total, 0 mapped to tasks, 16 pending ⚠️

---

## Success Criteria

- [ ] User can create, name, rename, and delete folders without page reload
- [ ] Sidebar correctly renders folders > root diagrams hierarchy
- [ ] Diagrams without a folder remain at root — no data migration or breaking change
- [ ] Drag-and-drop moves diagrams between folders and root (P2)
- [ ] All folder state persists across page reloads (expand/collapse in localStorage, data in DB)
- [ ] Deleting a folder never deletes diagrams — they always fall back to root
