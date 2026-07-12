# M9 — Captured Context & Decisions

Gray areas surfaced during Specify that need an explicit decision before/within Design. Recorded here
so Design and Tasks build on settled ground. **D1 is the load-bearing risk of the whole milestone.**

---

## D1 — Where does server-side Mermaid conversion run? ⚠️ LOAD-BEARING

**The problem.** The pipeline is two upstream calls:

```js
const { elements, files } = await parseMermaidToExcalidraw(spec, { fontSize })  // step 1
const full = convertToExcalidrawElements(elements)                              // step 2
```

- **Step 1** (`@excalidraw/mermaid-to-excalidraw`) drives the `mermaid` library, which calls
  `mermaid.render` → produces SVG and **measures text via SVG layout APIs** (`getComputedTextLength`,
  `getBBox`). Those require a DOM. Confirmed via Excalidraw docs + Mermaid's SVG rendering step
  (https://docs.excalidraw.com/docs/@excalidraw/mermaid-to-excalidraw/api, mermaid render pipeline).
- **Step 2** (`convertToExcalidrawElements` from `@excalidraw/excalidraw`) lives in a browser/UMD
  package whose top-level import touches `window`.

Neither runs in vanilla Node out of the box. This directly threatens the M9 goal "testable without
MCP / no browser." **This is the milestone's #1 risk and is why T1 is a hard spike gate.**

**Options considered.**

| Option | How | Verdict |
|---|---|---|
| **A. Node + jsdom DOM shim** | Polyfill `global.document`/`window`/`DOMParser` with `jsdom` (+ SVG measurement stubs) inside `lib/spec-to-excalidraw.ts`; import both libs normally. | **Preferred IF the spike proves layout is acceptable.** Lightest runtime; runs in Vitest with no browser. Risk: jsdom lacks real SVG text metrics → node sizes may be approximate/zero. Mitigation: stub `getComputedTextLength`/`getBBox` with a deterministic width heuristic; layout need only be *valid & renderable*, not pixel-perfect. |
| **B. Headless Chromium (Playwright)** | Run both steps inside a real browser page server-side; return elements over the bridge. Playwright already a devDep. | **Fallback if A fails.** Reliable metrics, but adds a heavy prod runtime dep + cold-start cost; awkward on serverless (Vercel). Behind the same module interface so nothing downstream changes. |
| **C. Client-side conversion** | Browser converts, POSTs full elements to a plain create route. | **Rejected.** M9 must be headless/server (M10 MCP has no browser). Violates the goal. |

**Decision (recommended default, to confirm in T1):** Implement **Option A** behind a single module
boundary `lib/spec-to-excalidraw.ts`. T1 spikes it: if A produces valid, deserializable, binding-intact
elements for the fixture set, ship A. If A cannot (SVG metrics unfixable), fall back to **Option B**
*without changing any caller* — the route, service, and tests only depend on `specToExcalidraw()`.

**Consequence for Tasks:** T1 is a gate. T2 codes against whichever runtime T1 blesses. All downstream
tasks (T4 route, T5 suite, T6 e2e) are agnostic to the choice.

### T1 SPIKE OUTCOME (resolved) ✅

Ran the spike in raw Node, vite/Vitest, and a forced node-env test. Findings:

1. **`parseMermaidToExcalidraw` (step 1) runs headless** in Node once a jsdom DOM + stubbed SVG text
   metrics (`getComputedTextLength`/`getBBox`) are installed. ✔
2. **`convertToExcalidrawElements` from `@excalidraw/excalidraw` (step 2) is NOT usable server-side.**
   The package has no util-only entrypoint; importing the barrel *evaluates the entire editor* (React
   dialogs that self-initialize → `Cannot use 'in' operator ... in null` at `ImageExportDialog.tsx`).
   Its prod bundle also uses an extensionless `roughjs/bin/rough` import that Node/vite SSR won't
   resolve. Neither a jsdom shim nor vite inlining/prod-condition made it evaluable.

**Resolution — hybrid of Option A:** keep the jsdom shim for step 1, and **replace step 2 with an
in-house pure converter** (`convertSkeleton`) that turns the Mermaid geometry skeleton into
fully-qualified Excalidraw elements (container↔label + arrow↔node bindings, all required fields). This
is exactly the roadmap's "Element Normalization" feature, and it drops the `@excalidraw/excalidraw`
runtime dependency entirely. Result: fully headless, pure, deterministic, testable with no browser.
Verified: 11 unit tests + 1 forced node-env test green (bindings intact, deterministic, deserializes).

Option B (headless Chromium) is therefore **not needed**. `@excalidraw/mermaid-to-excalidraw` is added
to `dependencies`; `jsdom` is promoted from dev to prod `dependencies` (the route uses it at runtime).

---

## D2 — Determinism strategy

**The problem.** `convertToExcalidrawElements` assigns `id`, `seed`, `versionNonce` using Excalidraw's
RNG and `updated` via time. That breaks GEN-10/11 (reproducible, snapshot-testable output).

**Decision.** After step 2, run a **deterministic normalization pass** in `lib/spec-to-excalidraw.ts`:

1. Sort elements into a stable order (by original ordinal from the skeleton).
2. Reassign each element a deterministic `id` = short hash of `(type + rounded geometry + text + ordinal)`;
   `seed`/`versionNonce` = deterministic integers derived from the same hash; `version` = 1;
   `updated` = a fixed constant (e.g. `0`), never `Date.now()`.
3. Build an old-id → new-id map and **rewrite every cross-reference**: `boundElements[].id`,
   `startBinding.elementId`, `endBinding.elementId`, `groupIds`, `frameId`. (GEN-12)
4. Assign fractional `index` strictly ascending in that stable order (GEN-08).

Include the **ordinal** in the hash source so duplicate-label nodes don't collide (spec Edge Case).

---

## D3 — `folderId` ownership validation

**The problem.** `createDiagram` today takes no `folderId`. The existing `PUT /api/diagrams/:id` accepts
`folderId` and sets it via an owner-scoped `updateMany`, but does **not** verify the folder itself is
owned by the user (FK enforces existence, not ownership).

**Decision.** Extend `createDiagram(userId, name?, data?, folderId?)` (additive). In the `from-spec`
route, when `folderId` is present, validate ownership via the folders lib (owner-scoped lookup) and
return `400` if the folder isn't owned/found. This is a *small tightening* over the existing PUT path,
justified because `from-spec` is machine-facing (bearer) where cross-user probing is a realistic threat.

---

## D4 — `format` field

**Decision.** `format` is a required enum, only `"mermaid"` accepted this phase. Keeping the field (vs.
implying mermaid) future-proofs a DSL/other formats (M9 out-of-scope note) without a breaking change.
Unknown value → `400` (GEN-14).

---

## D5 — Empty-but-valid spec

**Decision.** A spec that parses to zero elements → **`400`** (`{ error: "Spec produced no elements" }`).
Rationale: an AI asking to create an empty diagram is almost always a mistake, and users have the normal
`POST /api/diagrams` for a blank canvas. Cheap to relax later if a real use case appears.

---

## D6 — Headless conversion limitations (discovered in implementation)

Verified type support under the jsdom runtime (mermaid 10.9.3):

| Mermaid type | Status |
|---|---|
| flowchart (label-free edges) | ✅ full — nodes, diamonds, arrows, bindings |
| sequence | ✅ full |
| class | ✅ full |
| ER | ⚠️ converts without error (minimal geometry); P2 |
| **flowchart with edge labels** (`-->\|text\|`) | ❌ **fails gracefully → 400** |

The edge-label case is the one real gap: Mermaid's edge-label placement walks
real SVG path geometry (`getPointAtLength`) that jsdom cannot provide, throwing
"Could not find a suitable point for the given distance". We stub path metrics
enough for ER/plain edges, but labeled edges still fail. This is caught and
returned as a graceful `400` (never a crash) and is asserted by an explicit
test so it's tracked, not silent. Fixing it would require Option B (headless
Chromium) — deferred; label-free flowcharts cover the common case.

## Open confirmations for the user

- **D1 default (Option A, spike-gated)** — confirm you're OK spiking jsdom first and only escalating to
  headless Chromium if it fails. If you'd rather commit to Chromium up front (more predictable, heavier),
  say so and T1 collapses into "wire Playwright conversion."
- **D5** (empty spec → 400) — confirm, or prefer creating an empty diagram.
