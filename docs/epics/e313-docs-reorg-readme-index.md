# E313 — Docs Reorganization + README Index

> Phase 73 · docs · DX
> Status: ⬜ pending

## Problem

The template's `docs/` root has 10 loose files that don't belong at the top level — they were created incrementally and never moved into proper subfolders. This creates navigational chaos: new users scan a flat list of 30+ items and can't quickly find what they need. The `ai-rc-engineer-pm` downstream project solved this with:
1. A `docs/README.md` canonical index (the "start here" document)
2. Loose root files moved to proper subfolders with redirect notes

Current loose root files that need relocation:
- `CANARY_DEPLOY.md` → `deployment/canary-deploy.md`
- `ERROR_BUDGET.md` → `deployment/error-budget.md`
- `SECRET_ROTATION.md` → `deployment/secret-rotation.md`
- `CONTEXT_BUDGET.md` → `reference/context-budget.md`
- `nextjs-background.md`, `nextjs-best-pratice.md`, `nextjs-layout.md` → `techstack/`
- `presentations/` → `archive/`
- `superpowers/` → `archive/`

Also missing: `docs/playbooks/` (end-to-end runbooks), `docs/qa/` structure.

## Solution

1. **`docs/README.md`** — canonical docs index. Table: folder → purpose → live/archive status. "Start here" document that agents and humans read first. Port from rc-engineer-pm; strip rc-specific (`_handoff/`, `qa/manual-test-plan` custom section). Include: live folders, append-only history, assets, and the "new docs go here" rule.
2. **Move loose root files** to proper subfolders (git mv to preserve history).
3. **Add `docs/playbooks/`** — one initial playbook: `mockup-to-production.md` (end-to-end: HTML handoff → `/athena:plan mockup` → `/athena:batch` → PR → Cloudflare Pages deploy).
4. **Update cross-references** — any file that links to moved docs gets its link updated.
5. **Update `CLAUDE.md`** — docs index section points to `docs/README.md`.

## Key Files

- `docs/README.md` (NEW) — canonical docs index
- `docs/CANARY_DEPLOY.md` → `docs/deployment/canary-deploy.md` (moved)
- `docs/ERROR_BUDGET.md` → `docs/deployment/error-budget.md` (moved)
- `docs/SECRET_ROTATION.md` → `docs/deployment/secret-rotation.md` (moved)
- `docs/CONTEXT_BUDGET.md` → `docs/reference/context-budget.md` (moved)
- `docs/nextjs-background.md` → `docs/techstack/nextjs-background.md` (moved)
- `docs/nextjs-best-pratice.md` → `docs/techstack/nextjs-best-practice.md` (moved, fix typo)
- `docs/nextjs-layout.md` → `docs/techstack/nextjs-layout.md` (moved)
- `docs/presentations/` → `docs/archive/presentations/` (moved)
- `docs/superpowers/` → `docs/archive/superpowers/` (moved)
- `docs/playbooks/mockup-to-production.md` (NEW)

## Implementation

### Phase 1 — Create docs/README.md
- Write the canonical docs index: every folder with one-line purpose and live/archive status. Include the "new docs go here" rule (one row per folder, no new top-level folders without adding a row). Adapt from rc-engineer-pm's `docs/README.md` — strip `_handoff/`, `qa/`, rc-specific rows.
- Index key docs: `TEMPLATE-VS-PRODUCT.md` (from E312), `epics/EPIC_INDEX.md`, `context/session-summary.md`, `reference/README.md` (from E311).

### Phase 2 — Move loose root files
```bash
git mv docs/CANARY_DEPLOY.md docs/deployment/canary-deploy.md
git mv docs/ERROR_BUDGET.md docs/deployment/error-budget.md
git mv docs/SECRET_ROTATION.md docs/deployment/secret-rotation.md
git mv docs/CONTEXT_BUDGET.md docs/reference/context-budget.md
git mv docs/nextjs-background.md docs/techstack/nextjs-background.md
git mv "docs/nextjs-best-pratice.md" docs/techstack/nextjs-best-practice.md
git mv docs/nextjs-layout.md docs/techstack/nextjs-layout.md
git mv docs/presentations docs/archive/presentations
git mv docs/superpowers docs/archive/superpowers
```
- Grep for cross-references to moved files and update them.

### Phase 3 — Playbooks + cross-references
- Create `docs/playbooks/` folder with `mockup-to-production.md`: end-to-end flow from HTML mockup to production. Steps: receive handoff → `/athena:plan mockup <path>` → review proposals → approve → `/athena:batch auto` execute → `/athena:align` audit → PR → merge → Cloudflare Pages deploy.
- Update `CLAUDE.md` § "What This Project Is" / docs references to point to `docs/README.md` as the canonical index.
- Update `dev-docs/docs/index.md` if it links to any moved files.

## Acceptance Criteria

- [ ] `docs/README.md` exists with a row for every `docs/` subfolder
- [ ] All 10 loose root files moved to correct subfolders (git mv — history preserved)
- [ ] No broken internal doc links (`grep -rn "CANARY_DEPLOY\|ERROR_BUDGET\|SECRET_ROTATION\|CONTEXT_BUDGET\|nextjs-background\|nextjs-best-pratice\|presentations/" docs/` returns no live cross-references pointing at old paths)
- [ ] `docs/playbooks/mockup-to-production.md` exists
- [ ] CLAUDE.md references `docs/README.md` as the docs entry point
- [ ] `pnpm typecheck && pnpm lint` clean (no app changes)

## Cross-Epic

- E311 — `docs/reference/README.md` created there is indexed here
- E312 — `docs/TEMPLATE-VS-PRODUCT.md` created there is indexed here
- E314 — `docs/architecture/` index row added once service-maps land

## Out of Scope

- Moving epic spec files (they stay in `docs/epics/`)
- Restructuring `docs/context/` (agent write-back memory, handled by agents)
- Creating `docs/qa/` manual test plan (rc-specific concern; template's qa lives in `pnpm test:e2e`)
