# Generation Layer (spec → Excalidraw) Specification

## Problem Statement

M8 gave headless clients a way to authenticate. But an AI agent still cannot *produce* a diagram:
the only create path (`POST /api/diagrams`) expects a caller who already holds valid Excalidraw
`elements[]` — fractional `index`, `seed`, `versionNonce`, `roundness`, `groupIds`, and correctly
wired arrow bindings. An LLM cannot author that raw JSON reliably; it would drift, break bindings,
and desync z-order. The core epic principle is that the AI **never** writes raw Excalidraw — it
speaks Mermaid, and the server converts and normalizes into valid Excalidraw JSON.

M9 builds that generation layer: a server endpoint that takes a Mermaid spec and returns a persisted
Diagram whose canvas opens with no rendering errors, connectors attached, and stable ordering. It is
the value core of the epic — M10's MCP is a thin shell over it. It must be fully testable without
MCP or a browser.

## Goals

- [ ] A caller (session or bearer key) can POST a Mermaid spec and get back a persisted `DiagramDetail`.
- [ ] The produced canvas opens in Excalidraw with **no rendering errors** — every required element
      field is present and valid.
- [ ] Arrow/connector bindings survive conversion: `boundElements` + `startBinding`/`endBinding`
      stay attached to their nodes.
- [ ] Output is **deterministic**: the same spec produces byte-identical element identity (ids, seed,
      versionNonce, z-order) — no reliance on `Date.now()`/RNG for identity.
- [ ] Conversion runs entirely server-side (headless) so the endpoint and its tests need no browser.
- [ ] An unparseable or unsupported spec fails with a graceful `400` (never a `500`, never a broken
      diagram).

## Out of Scope

| Feature | Reason |
|---|---|
| Editing existing diagrams (add/connect/update/remove) | M11 (Incremental Editing) |
| Auto-layout beyond what Mermaid emits (e.g. dagre re-layout) | M12 (Polish) |
| A custom DSL | Only if Mermaid proves insufficient; not now |
| Styling / theming controls (colors, fonts as inputs) | Create uses Mermaid/Excalidraw defaults; presentation is later |
| Image / file (binary) elements in the spec | Mermaid text diagrams only in this phase |
| Thumbnail generation on create-from-spec | M12 (field exists, stays null) |
| MCP tool wrapping this endpoint | M10 (thin shell over this) |
| Mermaid diagram types the upstream lib does not support | Bounded by `@excalidraw/mermaid-to-excalidraw` support |

---

## User Stories

### P1: Create a diagram from a Mermaid spec ⭐ MVP

**User Story**: As a headless client (the future MCP), I want to POST a Mermaid spec and receive a
persisted, openable diagram so that an LLM can turn natural language into an editable canvas.

**Why P1**: This is the entire value of the epic — without it M10 has nothing to wrap.

**Acceptance Criteria**:

1. WHEN a caller POSTs `{ spec, format: "mermaid" }` (optional `name`, `folderId`) with a valid session
   OR bearer key THEN system SHALL convert the spec, persist a Diagram owned by the actor, and return
   `DiagramDetail` with `201`.
2. WHEN no `name` is supplied THEN system SHALL apply the same default-name behavior as `createDiagram`.
3. WHEN the request carries neither a session nor a valid bearer key THEN system SHALL return `401`
   (reusing `requireActor`, identical to the existing diagram routes).
4. WHEN a `folderId` is supplied THEN system SHALL attach the diagram to that folder only if the folder
   is owned by the actor; a folder not owned (or not found) SHALL yield `400` — never a cross-user attach.

**Independent Test**: `curl -H "Authorization: Bearer sk_…" -d '{"spec":"flowchart TD\nA-->B","format":"mermaid"}' /api/diagrams/from-spec` returns `201` with a `DiagramDetail`; the diagram is then retrievable via `GET /api/diagrams/:id` as the same user.

---

### P1: Produce valid, renderable Excalidraw elements ⭐ MVP

**User Story**: As a user opening a generated diagram, I want the canvas to render with no errors so
that the AI's output is actually usable.

**Why P1**: A diagram that throws on open is worthless; correctness of the element payload is the
hard technical core.

**Acceptance Criteria**:

1. WHEN a spec is converted THEN system SHALL emit elements that carry every required Excalidraw field:
   fractional `index`, `seed`, `version`, `versionNonce`, `roundness`, `groupIds` (via
   `convertToExcalidrawElements`).
2. WHEN a spec defines connectors (arrows/edges) THEN system SHALL preserve their bindings: each arrow
   has `startBinding`/`endBinding` referencing existing node ids, and those nodes list the arrow in
   `boundElements`.
3. WHEN elements are emitted THEN system SHALL assign strictly ascending fractional `index` values so
   z-order is stable and deterministic.
4. WHEN the conversion output is fed through `deserializeCanvas` (`lib/excalidraw.ts`) THEN system SHALL
   yield a valid `ExcalidrawState` (elements array + `appState` + `files`) with no thrown errors.

**Independent Test**: Convert `flowchart TD\nA-->B`; assert the arrow's `startBinding.elementId` and
`endBinding.elementId` match the two node ids, both nodes' `boundElements` include the arrow id, and
`deserializeCanvas` returns the elements unchanged in count.

---

### P1: Deterministic output ⭐ MVP

**User Story**: As a maintainer, I want the same spec to always produce the same element identity so
that outputs are reproducible, testable with fixtures, and diff-stable.

**Why P1**: Non-determinism (random ids/seed/versionNonce, `Date.now()`) makes the conversion
untestable by snapshot and makes M11 diffing impossible.

**Acceptance Criteria**:

1. WHEN the same spec is converted twice THEN system SHALL produce elements with identical `id`, `seed`,
   `versionNonce`, and `index` for corresponding elements.
2. WHEN elements are assigned identity THEN system SHALL derive it deterministically (e.g. from element
   position/content + ordinal), NOT from `Date.now()` or a non-seeded RNG.
3. WHEN identity is reassigned THEN system SHALL rewrite every cross-reference (`boundElements`,
   `startBinding.elementId`, `endBinding.elementId`, `groupIds`, `frameId`) so no binding dangles.

**Independent Test**: Convert the same spec twice in one test run; deep-equal the two element arrays.
Assert no binding references an id absent from the element set.

---

### P1: Graceful failure on bad input ⭐ MVP

**User Story**: As any caller, I want a clear `400` when my spec is malformed so that I can correct it
instead of getting an opaque server error.

**Why P1**: An LLM will send imperfect specs constantly; the endpoint must degrade cleanly.

**Acceptance Criteria**:

1. WHEN `spec` is missing, empty, or not a string THEN system SHALL return `400` with a field error
   (Zod), before attempting conversion.
2. WHEN `format` is absent or not `"mermaid"` THEN system SHALL return `400` (only `mermaid` is supported
   this phase).
3. WHEN `spec` is a syntactically invalid Mermaid definition THEN system SHALL catch the parser error and
   return `400` JSON `{ error: … }` — never `500`, never a persisted broken diagram.
4. WHEN conversion fails THEN system SHALL NOT create a Diagram row (no partial writes).

**Independent Test**: POST `{ spec: "this is not mermaid", format: "mermaid" }` → `400`; POST
`{ spec: "flowchart TD\nA-->B", format: "svg" }` → `400`; DB row count unchanged in both cases.

---

### P2: Multi-type Mermaid support

**User Story**: As a user, I want flowchart, sequence, class, and ER diagrams to all convert so that
the AI can express different diagram kinds.

**Why P2**: Flowchart alone proves the pipeline; broader type coverage is validated-then-widened, and
is bounded by what the upstream library supports.

**Acceptance Criteria**:

1. WHEN a spec of a type supported by `@excalidraw/mermaid-to-excalidraw` (flowchart, sequence, class,
   ER, …) is submitted THEN system SHALL convert it with the same guarantees as flowchart.
2. WHEN a Mermaid type is NOT supported by the upstream library THEN system SHALL surface the library's
   error as a `400` (same graceful path as invalid syntax).

**Independent Test**: The validation suite converts one fixture per supported type and asserts each
yields valid, deserializable elements.

---

## Edge Cases

- WHEN the spec parses but yields zero elements (e.g. an empty flowchart) THEN system SHALL still create
  a valid (empty-ish) diagram OR return `400` — decision recorded in design; must not `500`.
- WHEN `convertToExcalidrawElements` produces elements referencing files (labels/images) THEN system
  SHALL carry the `files` map through into the persisted `data` so labels render.
- WHEN the same spec contains duplicate node labels THEN system SHALL keep node ids unique and bindings
  correctly targeted (no id clash from deterministic hashing — include ordinal in the identity source).
- WHEN a very large spec is submitted THEN system SHALL rely on the existing diagram payload-size
  handling (M2b); no new limit is introduced here.
- WHEN a bearer key targets `from-spec` THEN system SHALL behave exactly like the other diagram routes
  (bearer allowed via the M8 middleware allowance; ownership derived from the actor).
- WHEN the server runtime cannot host the conversion (DOM/measurement failure) THEN this is a build/deploy
  failure surfaced by the T1 spike — NOT a runtime `500` shipped to users (see context.md D1).

---

## Data Model

**No schema change.** M9 reuses the existing `Diagram` model and `createDiagram` unchanged in shape —
it only produces valid `data` (an `ExcalidrawState`) to hand to it. `createDiagram` is extended with an
optional `folderId` parameter (owner-scoped), additive and backward-compatible.

New API surface:

- `POST /api/diagrams/from-spec` — session **or** bearer (M8 actor); body
  `{ name?: string, folderId?: string, spec: string, format: "mermaid" }`; returns `DiagramDetail` (`201`)
  or `400`/`401`.

New library module:

- `lib/spec-to-excalidraw.ts` — pure-ish conversion + normalization: `specToExcalidraw(spec, format)`
  → `{ elements, appState, files }` (an `ExcalidrawState`), deterministic, throwing a typed
  `SpecParseError` on bad input.

---

## Security Notes

- Ownership is derived from the resolved **actor** (`requireActor`), never from client input — identical
  guarantee to `POST /api/diagrams`.
- `folderId`, if provided, MUST be validated as owned by the actor before attach — prevents writing a
  diagram into another user's folder namespace.
- The Mermaid parser MUST run in a sandboxed/headless context that cannot be steered into SSRF or file
  access; Mermaid config MUST have `securityLevel` locked down (no click/script directives executed),
  and any HTML label sanitization the upstream lib performs MUST be preserved (see context.md D1).
- Conversion errors MUST be caught and mapped to `400`; a raw parser stack trace MUST NOT leak to the client.

---

## Requirement Traceability

| Requirement ID | Story | Status |
|---|---|---|
| GEN-01 | P1: `POST /api/diagrams/from-spec` accepts spec, session-or-bearer, returns `DiagramDetail` 201 | Pending |
| GEN-02 | P1: Default name applied when none supplied (reuse `createDiagram`) | Pending |
| GEN-03 | P1: Unauthenticated → 401 via `requireActor` | Pending |
| GEN-04 | P1: `folderId` optional; owner-scoped; non-owned/missing → 400, no cross-user attach | Pending |
| GEN-05 | P1: Convert Mermaid → skeleton via `parseMermaidToExcalidraw` | Pending |
| GEN-06 | P1: Expand → full elements via `convertToExcalidrawElements` (index/seed/version/versionNonce/roundness/groupIds) | Pending |
| GEN-07 | P1: Arrow bindings intact (`boundElements` + `startBinding`/`endBinding`) | Pending |
| GEN-08 | P1: Strictly ascending fractional `index` → stable z-order | Pending |
| GEN-09 | P1: Output passes `deserializeCanvas` → valid `ExcalidrawState` | Pending |
| GEN-10 | P1: Deterministic identity (id/seed/versionNonce/index stable across runs) | Pending |
| GEN-11 | P1: Deterministic identity derived from content+ordinal, not `Date.now()`/RNG | Pending |
| GEN-12 | P1: Identity reassignment rewrites all cross-refs (no dangling bindings) | Pending |
| GEN-13 | P1: Missing/empty/non-string `spec` → 400 (Zod, pre-conversion) | Pending |
| GEN-14 | P1: `format` absent or ≠ `"mermaid"` → 400 | Pending |
| GEN-15 | P1: Invalid Mermaid syntax → 400 JSON, no `500`, no persisted row | Pending |
| GEN-16 | P1: Conversion runs server-side/headless — endpoint + tests need no browser | Pending |
| GEN-17 | P1: `files` map carried through into persisted `data` | Pending |
| GEN-18 | P2: Multi-type support (flowchart, sequence, class, ER) with same guarantees | Pending |
| GEN-19 | P1: Validation suite — spec in → `deserializeCanvas` → elements valid + bindings intact | Pending |

**Coverage:** 19 total, 0 mapped to tasks, 19 unmapped ⚠️ (mapped in tasks.md)

---

## Success Criteria

- [ ] `curl -H "Authorization: Bearer sk_…" -d '{"spec":"flowchart TD\nA-->B","format":"mermaid"}' $ORIGIN/api/diagrams/from-spec` → `201` `DiagramDetail`; the id then opens in the editor with no console/render error.
- [ ] Converting a connector spec yields arrows whose `startBinding`/`endBinding` point at real nodes and whose nodes reference the arrow in `boundElements`.
- [ ] The same spec converted twice is deep-equal (deterministic identity).
- [ ] Garbage spec and non-`mermaid` format both return `400`; no Diagram row is written for either.
- [ ] The full conversion + endpoint test suite runs green in CI with **no browser** (Node/Vitest only).
- [ ] All pre-existing tests still pass (zero regression), including the M8 bearer path.
