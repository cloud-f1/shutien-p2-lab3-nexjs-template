# E54 — Design Artifacts Audit
> Phase 18 — Repo Simplification (Cycle 5)
> Priority: P2 | Size: M | Points: 5

## Problem

Design-phase artifacts (`docs/design/` HTML prototypes at 220K, `docs/blueprints/` at 32K, `docs/landing/` at 16K) were used to build actual pages but are no longer referenced by build, test, or CI. They inflate the repo and add noise. Additionally, `docs/techstack/` (48K, 9 files) overlaps with root `TECHSTACK.md`.

## Stories

- [ ] Move `docs/design/*.html` prototypes to `docs/archive/design-originals/`
- [ ] Move `docs/blueprints/` contents to `docs/archive/blueprints/`
- [ ] Move `docs/landing/` contents to `docs/archive/landing/`
- [ ] Evaluate `docs/techstack/` overlap with `TECHSTACK.md` — consolidate or document the distinction
- [ ] Verify no build scripts, tests, or CI reference the moved files

## Acceptance Criteria

- HTML prototypes from `docs/design/` relocated to `docs/archive/design-originals/`
- `docs/blueprints/` contents relocated to `docs/archive/blueprints/`
- `docs/landing/` contents relocated to `docs/archive/landing/`
- `docs/techstack/` evaluated — either consolidated or distinction documented
- No broken references in any script, test, or CI config
- Git history preserves all file content

## Dependencies

None (all parallel)
