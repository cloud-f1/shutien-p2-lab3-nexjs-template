---
name: design-sync-roundtrip
description: >
  The Claude Design ↔ repo round-trip protocol: which claude.ai/design project
  type is which and why that choice is permanent, how the component library
  reaches a design-system project, how design canvas output flows back into
  docs/_handoff/, and the traps hit when running this sync (reserved paths
  reject a whole write_files batch, list_projects hides non-design-system
  projects, a 256 KiB get_file cap, project type is immutable after creation).
  Use when syncing design context to claude.ai/design, pulling redesigned
  screens back into the repo, deciding "which design project do we use",
  setting up a design-system project for the first time, or re-running a
  design sync after component changes.
---

# Claude Design ↔ Repo Round-Trip

> **Provenance note:** this skill is adapted from a sibling fork
> (`ai-rc-engineer-pm`) that has actually run this sync against a real
> Claude Design account. This template has **not** — there is no
> `.design-sync/config.json`, no design project, and no completed sync in
> this repo as of this writing. Every claim below is labeled **已驗證**
> (confirmed against this template) or **承襲自 fork，未在模板驗證**
> (carried over from the fork's experience, not yet confirmed here). Treat
> the unverified ones as a strong prior, not a guarantee — confirm against
> the actual tool/API behavior the first time you rely on one.

## The one irreversible decision, first

Claude Design projects come in two types. **The type is fixed at creation
and cannot be changed afterward** — creating a canvas project when you meant
a design-system project (or vice versa) means abandoning it and creating a
new one, not fixing it in place. Decide which you're creating *before* you
click create. *(承襲自 fork，未在模板驗證 — not independently re-tested here.)*

| Type | Job | Who writes to it |
|---|---|---|
| `PROJECT_TYPE_DESIGN_SYSTEM` | The **component library** — compiled from this repo's `next-app/components/**` | **Only** the `/design-sync` tool/skill. Never hand-edit its files; re-run the sync instead. |
| `PROJECT_TYPE_PROJECT` | The **design canvas** — where screens/prototypes actually get designed | Designers / design agents work here directly. |

If you're not sure which one an existing project is, that's a sign to check
`.design-sync/config.json` (below) before writing anything to it.

## The four data flows

Paths below are this template's — `docs/_handoff/` is the landing zone for
design context per E342 (see note); it may not exist yet if E342 hasn't
landed in your checkout.

```
① next-app/components/** ──/design-sync──▶ Design System project      (library refresh)
② docs/_handoff/ ──write_files──▶ design canvas project                (context in: PRD / domain notes / epic digest)
③ design canvas project ──get_file──▶ docs/_handoff/<project>/         (design output back into git)
④ docs/_handoff/ ──/athena:plan mockup──▶ docs/epics/                  (handoff → UI-ready epics; see mockup-to-epics skill)
```

- **① Library refresh** (repo → design-system project): keeps the
  component palette the design canvas composes from up to date with what
  actually exists in `next-app/components/**`. Run after any change to a
  shared component that the design system should reflect.
- **② Context push** (repo → canvas project): pushes paste-ready brief /
  PRD deltas / domain-knowledge updates from `docs/_handoff/` into the
  canvas project so design work has current context.
- **③ Design pull-back** (canvas project → repo): after a redesign session,
  pull the changed screen files out of the canvas project and commit them
  under `docs/_handoff/`. **`docs/_handoff/` is the SSOT the epics cite** —
  an un-pulled redesign is invisible to `/athena:plan mockup` and to
  `alignment-audit`.
- **④ Handoff → epics** (repo → repo): once design output is committed,
  hand it to the `mockup-to-epics` skill / `/athena:plan mockup` to turn it
  into UI-ready epics. This step is entirely this repo's existing pipeline —
  no external tool involved.

*(Flow shape ① –④ and their traps below: 承襲自 fork，未在模板驗證. Path
mapping onto `docs/_handoff/` / `docs/epics/`: 已驗證 — those are this
template's real, existing directories/conventions, docs/_handoff/ pending
on E342.)*

## Configuration, not hardcoding

Project IDs, package shape, and per-component overrides belong in a
committed config file, **not** scattered through this skill's prose or
inline in prompts — that way the next agent (or you, next month) reads one
file instead of re-deriving the setup from memory.

`.design-sync/config.json` (repo-root or `next-app/`, pick one and be
consistent) holds:

| Field | Meaning |
|---|---|
| `projectId` | The design-system project's UUID (flow ①'s target). **Placeholder — put your project's real UUID here, never in this skill file.** |
| `shape` | How the library is packaged for Claude Design, e.g. `"package"`. |
| `pkg` | Which workspace package/dir the components are compiled from, e.g. `next-app`. |
| `globalName` | The global namespace the compiled bundle exposes to the design canvas. |
| `componentSrcMap` | Component name → source file path, so the sync knows what maps to what. |
| `overrides` | Per-component exceptions (props to hide, variants to rename, etc.) that don't fit the automatic mapping. |

A second, separate ID — the **canvas project's UUID** (flow ②③'s target) —
is a different project from the design-system one; keep both IDs in the
config rather than only one. *(承襲自 fork，未在模板驗證 — the fork also
tracked its canvas-project UUID alongside the design-system one; this
template has not yet defined where that second ID should live, so treat
`.design-sync/config.json` as the default place to add it too.)*

### First-time setup (what to do if none of this exists yet)

This is the fork's observed setup flow, not something re-verified in this
template — confirm each step against the actual Claude Design UI/tool
behavior as you go:

1. Create the design-system project in Claude Design, explicitly choosing
   `PROJECT_TYPE_DESIGN_SYSTEM`. Note its UUID.
2. Create the canvas project, explicitly choosing `PROJECT_TYPE_PROJECT`.
   Note its UUID.
3. In the Claude Design UI, attach the design-system project to the canvas
   project so the canvas composes from the real component library instead
   of generic primitives.
4. Write both UUIDs plus the package config into `.design-sync/config.json`
   and commit it (no UUIDs in prose, PRs, or chat).
5. Run `/design-sync` (or the equivalent bundled tool in your setup) to do
   the first library push (flow ①).

*(承襲自 fork，未在模板驗證 — this template has never executed this
sequence; there is no `/design-sync` command shipped here today. If you add
one, update this section to point at it.)*

## Traps

Each one is labeled with how much you can trust it in *this* repo.

1. **Reserved paths reject the whole batch.** A `write_files` call that
   includes a reserved path (e.g. `CLAUDE.md`, `.claude/`) is rejected in
   its **entirety**, not partially applied — nothing in that batch lands,
   including the unrelated files in it. Split reserved-path content out and
   deliver it by another channel (paste by hand). *(承襲自 fork，未在模板驗證)*
2. **`list_projects` only shows design-system-type projects.** A
   `PROJECT_TYPE_PROJECT` canvas will not appear in that listing — that does
   not mean it's inaccessible, only that you must already know and use its
   UUID directly for reads/writes. *(承襲自 fork，未在模板驗證)*
3. **`get_file` caps at 256 KiB.** A large combined prototype file can
   exceed this; pull per-screen/per-component files instead of one giant
   bundle. *(承襲自 fork，未在模板驗證)*
4. **Incremental sync anchors off a sync-state file** (the fork's was
   `_ds_sync.json`) so components unchanged since the last sync are skipped
   from re-verification. If you rename/move a component without touching
   its content, the anchor may not notice — check the anchor file's logic
   before assuming "unchanged" really means "no action needed."
   *(承襲自 fork，未在模板驗證)*
5. **Mid-run corrections must be written down or they get lost.** If you
   discover a fix while running a sync (a mis-mapped component, a wrong
   assumption), put it in `.design-sync/config.json` (if it's a config
   field) or a `.design-sync/NOTES.md` (if it's not), and commit — otherwise
   the next run/agent re-discovers the same thing from scratch.
   *(承襲自 fork，未在模板驗證)*
6. **Build artifacts must be gitignored, not committed.** A sync of this
   shape generates local build/type artifacts to make components consumable
   by the design tool; these are regenerated by re-running the sync and
   should never be committed. See `next-app/.gitignore` (updated by this
   epic) for the concrete patterns. *(已驗證 — the gitignore entries this
   epic adds are real and checked in; the exact filenames a hypothetical
   sync would emit are 承襲自 fork, since no such tool runs in this template
   yet — adjust the patterns if your implementation names files differently.)*
7. **Project type is immutable** (repeated from the top because it's the
   costliest mistake): there is no "convert this project's type" operation.
   *(承襲自 fork，未在模板驗證)*

## Division of labor with sibling skills/agents

- **mockup-to-epics** — one-way ingestion of a handoff bundle into epics
  (flow ④). This skill hands off to it once design output is committed.
- **design-system** (project skill) — in-repo Tailwind/shadcn styling rules
  for writing the TSX that flow ① compiles from.
- **@designer** / `/athena:design` — generates a page from design tokens;
  a different (in-repo, no external tool) path to a TSX page.
- **THIS skill** — the map: which project, which direction, which tool,
  which traps. It does not reimplement ingest logic or styling conventions
  owned by the skills above.

## Checklist for "sync design both ways" requests

1. Confirm `.design-sync/config.json` exists and has both project UUIDs. If
   not, this is a first-time setup — see above, and note the human still
   needs to create the two Claude Design projects (this skill cannot do
   that for you).
2. If `next-app/components/**` changed since the last library sync, refresh
   the design-system project (flow ①).
3. Push updated context from `docs/_handoff/` to the canvas project (flow
   ②), minding the reserved-path trap.
4. After a redesign session in Claude Design: list files in the canvas
   project, pull each changed/new file back (flow ③) into `docs/_handoff/`,
   and commit — watch for files the redesign *added*, not just ones it
   changed, since the file set is not guaranteed stable.
5. If screens changed meaningfully, consider `/athena:align` (built app vs
   SSOT) and `/athena:plan mockup docs/_handoff/` for new/updated epics
   (flow ④).

Do not treat any step above as "already working here" — this checklist
describes the intended protocol; the first real run in this repo is where
each unverified trap above gets confirmed or corrected.
