# E52 — Epic Archive Consolidation
> Phase 18 — Repo Simplification (Cycle 5)
> Priority: P1 | Size: S | Points: 5

## Problem

The `docs/epics/` directory contains 48 individual spec files for completed epics (e0–e45), cluttering the working directory and slowing context loading. Additionally, `docs/specs/` holds 6 obsolete pre-epic spec files that predate the epic pipeline.

## Stories

- [ ] Create `docs/epics/archive/` directory if not exists
- [ ] Move completed epic specs `e0-*.md` through `e45-*.md` to `docs/epics/archive/`
- [ ] Keep `e46-*.md` through `e55-*.md` as active specs in `docs/epics/`
- [ ] Delete `docs/specs/auth-pages.md` (superseded by epic specs)
- [ ] Delete `docs/specs/dev-docs-vite.md` (superseded by epic specs)
- [ ] Delete `docs/specs/dev-phase-plan.md` (superseded by epic pipeline)
- [ ] Delete `docs/specs/test-plan-places.md` (domain-specific, not template-relevant)
- [ ] Delete `docs/specs/test-plan-portfolio.md` (domain-specific, not template-relevant)
- [ ] Delete `docs/specs/test-plan-template.md` (superseded by E15 quality framework)

## Acceptance Criteria

- `docs/epics/` contains only active specs (e46+), `EPIC_INDEX.md`, `CLAUDE.md`, and `archive/`
- `docs/epics/archive/` contains all completed specs (e0–e45) plus existing archive files
- `docs/specs/` has no obsolete files (6 deleted)
- No broken references in `EPIC_INDEX.md` or `CLAUDE.md`

## Dependencies

None (all parallel)
