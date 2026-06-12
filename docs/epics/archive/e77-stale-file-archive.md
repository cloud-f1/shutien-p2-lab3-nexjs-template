# E77 — Stale File Archive & Cleanup

> **Phase**: 23 | **Size**: S (3 SP) | **Priority**: P2
> **Depends on**: none
> **Branch**: `MH/feat/E77-stale-file-archive`
> **Status**: spec ✅

---

## Problem Statement

E52 archived E0–E45 epic specs to `docs/epics/archive/`, but 17 completed epic specs remain in the active `docs/epics/` directory. Additionally, two superseded checklists (`deploy-checklist.md`, `pre-release-checklist.md`) sit in `docs/` despite being replaced by the epic-driven pipeline. This clutter makes it harder to find active epics (E72+) and creates noise for template users who clone the repo.

## Stories

### S1: Archive Completed Epic Specs

**Scope**: 17 files — E46–E56 (11 files) + E66–E71 (6 files). E57–E65 never had spec files created.

**Files to move** (`docs/epics/` → `docs/epics/archive/`):
```
e46-visual-readme-onboarding.md
e47-fullstack-domain-generator.md
e48-devcontainer.md
e49-doc-consistency-sweep.md
e50-example-domain-ci-explainer.md
e51-dead-file-cleanup.md
e52-epic-archive-consolidation.md
e53-strategy-log-compression.md
e54-design-artifacts-audit.md
e55-gitignore-cleanup.md
e56-batch-epic-learning.md
e66-email-provider-refactor.md
e67-env-config-alignment.md
e68-deploy-script-email-update.md
e69-template-reset-script.md
e70-example-domain-extraction.md
e71-context-doc-reset.md
```

**AC**:
- [ ] Move all 17 files from `docs/epics/` to `docs/epics/archive/`
- [ ] Verify archive directory structure is consistent with existing E0–E45 archive (flat files, same naming)
- [ ] EPIC_INDEX.md references remain valid (they point to epic numbers, not file paths)
- [ ] Keep only active/pending epics (E72+) and meta files (EPIC_INDEX.md, CLAUDE.md) in `docs/epics/`

**Remaining after move**: `EPIC_INDEX.md`, `CLAUDE.md`, `e72-*`, `e73-*`, `e74-*`, `e75-*`, `e76-*`, `e77-*`

### S2: Archive Superseded Docs

**AC**:
- [ ] Create `docs/archive/` directory (currently only contains `blueprints/`, `design-originals/`, `landing/`)
- [ ] Move `docs/deploy-checklist.md` → `docs/archive/deploy-checklist.md`
- [ ] Move `docs/pre-release-checklist.md` → `docs/archive/pre-release-checklist.md`
- [ ] No active scripts or docs reference these files (verified — only referenced in archived epics E9 and E34)

### S3: Gitignore Hygiene

**AC**:
- [ ] `.DS_Store` is already in `.gitignore` (line 25) — confirmed ✅
- [ ] No tracked `.DS_Store` files found — confirmed ✅
- [ ] No action needed — document as verified

## Implementation Notes

- Pure file-move operation — zero code changes
- EPIC_INDEX.md does NOT use file paths for epic references, so moves are safe
- `docs/epics/archive/` already exists from E52 with 37 files (E0–E45 + phases-0-7.md)
- `docs/archive/` already exists but contains only subdirectories — checklist files will be the first loose files there
- Use `git mv` for all moves to preserve history
