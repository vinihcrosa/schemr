# Design

## Visual Direction

Schemr follows a **dark-mode-first, desktop-first, canvas-first** visual style, closely inspired by Excalidraw.

The interface should feel:
- Lightweight and non-intrusive
- Focused on content (diagrams), not UI chrome
- Slightly playful but not decorative
- Fast to parse, with low cognitive load

The base is built on soft dark neutrals — not high-contrast or aggressive. The goal is a **calm dark**, closer to a focused work tool than a flashy dashboard.

The editor experience takes precedence over all other surfaces. Supporting UI (navigation, lists, actions) should remain visually secondary and never compete with the canvas.

---

## Layout & Navigation

The product is structured around three surfaces:

1. **Auth (pre-app)**
   - Sign in / sign up screens
   - Minimal, centered layout
   - Consistent with the overall dark visual direction

2. **Diagram Index (secondary surface)**
   - Simple list/grid view
   - Each item shows: name + last updated timestamp
   - Primary actions: open diagram, create new diagram
   - Empty state with clear call to action

3. **Editor (primary surface)**
   - Full-screen canvas
   - Minimal top bar: inline title editing, save state, back navigation
   - No sidebar while editing
   - UI elements must not compete with the canvas

Navigation model:
- Entry → Diagram Index
- Click → Editor (full screen)
- Back → Index

No deep navigation hierarchy. At most 2 levels.

---

## Color & Typography

Color system is **dark-first**. Surfaces use soft dark neutrals; accent is used sparingly.

### Tokens

| Token | Description | Example |
|---|---|---|
| `background/base` | Main app background | Charcoal or very dark slate |
| `background/elevated` | Cards, panels, top bar | Slightly lighter dark gray |
| `border/subtle` | Dividers, input borders | Low-contrast cool gray |
| `text/primary` | Primary readable text | Off-white |
| `text/secondary` | Labels, timestamps, hints | Desaturated gray |
| `accent/primary` | CTAs, focus states, highlights | Soft blue or muted violet |

### Rules
- Dark ≠ high contrast. Avoid harsh white-on-black combinations.
- Use `accent/primary` sparingly — only for interactive feedback and primary actions.
- Prefer soft surfaces and low-contrast separators.
- No shadows, gradients, or decorative elements.

### Typography
- System font stack or clean sans-serif
- Prioritize readability over branding
- Minimal hierarchy — small scale variation

---

## Component Patterns

Components follow **functional minimalism** on a dark base.

### Buttons
- Primary: accent color fill, subdued
- Secondary: ghost or outline on dark background
- No heavy styling or gradients

### Inputs
- Dark background, subtle border
- Clear focus state using accent color
- No excessive decoration

### Modals
- Used sparingly
- Dark surface, centered
- Prefer inline actions when possible

### Toasts / Feedback
- Non-blocking, short-lived
- Used for: save confirmation, errors
- Subtle, bottom or top-right placement

### Empty States
- Minimal text
- Clear call to action (e.g., "Create your first diagram")

---

## Editor UX

The editor is powered by Excalidraw and should feel **native and uninterrupted**.

### Integration rules
- Do not override core Excalidraw interactions
- Avoid wrapping it with heavy UI layers
- Maintain its default behavior and shortcuts
- Canvas occupies maximum available space
- External controls (title, save state, back) stay outside the canvas in a minimal top bar

### Diagram naming
- Default title: `Untitled`
- Title is editable inline in the top bar of the editor
- No modal or separate screen for naming

### Autosave feedback
- Subtle save state indicator in top bar (e.g., "Saved", "Saving…")
- Must never block or interrupt canvas interaction
- Persistence must not freeze the UI

---

## Responsive & Platform

- **Desktop-first**: optimized for medium to large screens
- **Mobile**: not a priority in v1; basic access may exist but editing is not optimized
- Collapse non-essential UI on smaller screens; preserve editor usability above all else

---

## References

- **Excalidraw** — primary reference for interaction model and visual tone
- **Linear** — clean dark UI, restrained chrome, calm contrast
- **Notion** — simplicity and low visual noise

### Figma
Previous explorations (light-based, pre dark-first direction) available for structural reference. A new starter should be generated with the corrected brief:
- Dark-first, Excalidraw-inspired, minimal chrome
- Desktop-first
- Screens: editor, diagram index, auth
- Inline title editing in editor top bar
