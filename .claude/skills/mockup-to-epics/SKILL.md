---
name: mockup-to-epics
description: >
  Turn a Claude-Design / HTML-CSS-JS mockup handoff into UI-ready, build-grade
  epics. Use whenever the user drops a design bundle (a README pointing at HTML
  prototypes, or a folder of .html/.jsx/.css under a project/ dir) and wants it
  implemented as a real system. Teaches the run→screenshot→read-source→inventory
  →gap-analyze→enrich-epics pipeline so epics carry exact fields, validation,
  RBAC, layout dimensions, copy, and a shadcn/Tailwind style mapping — not vague
  "recipes". Pairs with /athena:plan (planning) and /athena:flow (execution).
user-invocable: true
---

# Mockup → UI-Ready Epics

A standard `/athena:plan` epic describes *intent* ("build the items list"). A mockup
handoff already contains the *answers* — exact fields, validation, layout, copy,
states, RBAC branches. If epics don't capture them, the build agent re-guesses and
drifts from the design. This skill makes epics **aligned to the mockup**.

## When to use

The user provides a design bundle — typically a `README.md` ("handoff from Claude
Design"), a `project/` folder with `.html` prototypes + source (`.jsx`/`.css`/`data.js`),
and possibly a `PRD.md` / domain doc. Trigger phrases: "implement this mockup", "make
the epics align to the HTML", "the epics look too simple / like a recipe".

If the design actually came from Claude Design (claude.ai/design) rather than a static
HTML drop, read the `design-sync-roundtrip` skill first — it covers which project type
holds the canvas, how to pull redesigned screens back into `docs/_handoff/`, and the
sync traps, before you start the ingestion pipeline below.

## The pipeline (do these in order)

### 1. Read the handoff contract first
Read the bundle `README.md` — it names the **primary file** the user had open and the
intended fidelity. Read any `PRD.md` + domain-knowledge doc: these are the SSOT for
rules (RBAC, status enums, delete policy, alert thresholds, vocabulary). Conflicts →
domain doc + latest user decision win.

### 2. Run it and "play" it (visual ground-truth)
The source is authoritative for *function*; screenshots are authoritative for *layout/
visual hierarchy/interaction*. Capture both. A self-contained single-file offline HTML
loads via `file://`; a multi-file prototype needs `python3 -m http.server`.

Use the helper: `node scripts/mockup/shot.cjs <abs-path-to-html> <out-dir> [tour.json]`
(Playwright + Chromium ship with `next-app`). Capture **every screen × each role**
(switch via demo-login personas or a tweaks panel), **key modals**, and **mobile**
(390px). Persist shots into the repo (e.g. `project/screenshots/`) so epics can
reference them durably. (The bundle README may say "don't screenshot" — that's its
default; the user asking for it overrides that.)

### 3. Read the source IN FULL (not summarized)
For each screen's source file, read every line. Extract: exact field names + types,
validation rules (e.g. "weights must sum to 100%", "note required"), conditional /
RBAC-gated rendering, copy strings (keep the original language), layout dimensions
(grid columns, widths, row heights, breakpoints), empty/loading/error/lock states, and
every mutation + what it logs. Parallelize across files with subagents when there are
many screens — one agent per 1–2 screens, each returning a structured inventory.

### 4. Inventory the target codebase (reuse vs build)
List what already exists (schema, auth/RBAC, routes, reusable components, design tokens)
so epics say "reuse `<DataTable>`/`<Dialog>`/audit_log" instead of rebuilding.

**This template's key reusable parts:**
- `components/data-table-generic.tsx` — `<DataTable>` with built-in filter + pagination
  + page-size; NEVER hand-roll a `<table>` for record lists.
- `components/confirm-dialog.tsx` — delete confirmation dialog.
- `components/ui/dialog.tsx` — shadcn `<Dialog>` for create/edit modals.
- CRUD pattern: modals (not page redirects), Server Actions return success (no `redirect`),
  `revalidatePath` + `router.refresh()` to refresh the list.
- `lib/is-admin.ts` — RBAC helpers (`isAdmin`, `canEdit`).
- `app/(dashboard)/dashboard/items/` — reference CRUD implementation.

Identify **conflicts** that need a user decision (role model, login method, scope) and
surface them via `AskUserQuestion` *before* writing epics.

Note: `docs/epics/_templates/ui-spec-epic.md` is the standard epic template. If it does
not exist in this repo, use the structure defined in step 5 below directly.

### 5. Write epics from the template
Use `docs/epics/_templates/ui-spec-epic.md` if it exists. Every UI epic MUST contain:
- **Route & Data** — server load list, visibility rule, what's server-derived.
- **Layout** (ASCII) + **Component Tree** (named).
- **Per-element / per-column tables** — element · spec · RBAC/state.
- **Tables/lists** — exact columns, filters, sort, pagination, empty state, row actions.
  Record lists use the project `<DataTable>` (`components/data-table-generic.tsx`) —
  never a hand-rolled `<table>` for record lists.
- **Modals** — a table of field · type · validation · default · copy, per modal.
  Create/edit modals use shadcn `<Dialog>`. Delete uses `<ConfirmDialog>`.
- **RBAC matrix** — every gated control × each role (admin/editor/viewer per this
  template's 3-tier system). Gated controls show a lock hint, not a hidden button.
- **Mutations → revalidation** — each Server Action → `revalidatePath` target; actions
  return success (no `redirect`).
- **Style mapping → shadcn/Tailwind** — map each prototype primitive + design token to
  the target component/utility (`Card`→`<Card>`, `Modal`→`<Dialog>`/`<Sheet>`,
  `ProgressBar`→`<Progress>`, inline `var(--x)`→Tailwind token). **Recreate the visual
  output; do not copy the prototype's inline-style structure.**
- **States** (empty/loading/error/lock/mobile) + **Acceptance Criteria tied to UI elements**.

### 6. Build a UI-foundation epic FIRST
The primitives (design tokens, shared components, missing shadcn parts like
`progress`/`textarea`/`date-picker`, mobile nav) gate every screen. Make it the first
epic in the entity phase. Note: epics that run `npx shadcn add` are **not worktree-safe**
→ run in-repo, not via a `/athena:flow` worktree.

## Integration with athena

- `/athena:plan` produces the epic *list + dependency DAG*; this skill defines their
  *depth*. Run plan to register epics, then enrich each with the template above.
- `/athena:flow` executes them. Pre-screen worktree-unsafe epics (shadcn-add, new deps,
  DB migrations that collide) and run those in-repo.
- Keep the design bundle committed in-repo so flow/worktree agents can read the source +
  screenshots at build time.

## Quality bar (self-check before declaring an epic "UI-ready")

- Could a build agent implement the screen pixel-aligned **without opening the mockup**?
- Is every modal's validation explicit? Every list's columns/filters/sort/pagination?
- Is every RBAC branch + its lock-hint copy specified?
- Does the style-mapping name a real target component for each primitive?
If any answer is "no", it's still a recipe — keep enriching.
