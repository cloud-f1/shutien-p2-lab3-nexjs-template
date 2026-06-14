# E71 — Context Doc Reset

> **Phase**: 21 | **Size**: S (3 SP) | **Priority**: P1
> **Depends on**: E69 (reset script references these templates)
> **Branch**: `feat/E71-context-doc-reset`

---

## Problem Statement

`docs/context/` files contain 21 phases of project history (epic-progress with 68 rows, strategy-log with 6 completed cycles, session-summary with Phase 19+20 references). Template users inherit this alien state. The reset script (E69) will clean these, but we need proper template-ready versions of each file.

## Solution

Create template-ready versions of all 9 context docs as the "clean state" that both:
1. The reset script (E69) copies into place
2. Git tracks as the default for new clones

## Stories

### S1: Template-Ready Context Files

**AC**:
- [ ] `docs/context/epic-progress.md` — empty phase table + empty step matrix + clean dependency rules section
- [ ] `docs/context/strategy-log.md` — blank "Current Cycle" (Cycle 1, state PENDING), empty Completed Cycles, empty Deferred Ideas
- [ ] `docs/context/session-summary.md` — starter template with "No sessions yet" placeholder
- [ ] `docs/context/spec-log.md` — header + empty log
- [ ] `docs/context/review-log.md` — header + empty log
- [ ] `docs/context/debug-log.md` — header + empty log
- [ ] `docs/context/test-status.md` — header + empty log
- [ ] `docs/context/deploy-log.md` — header + empty log
- [ ] `docs/context/decisions.md` — header + template architectural decisions only (GUID pattern, JWT strategy)
- [ ] `docs/context/qa-patterns.md` — header + empty patterns list
- [ ] `docs/context/CLAUDE.md` — unchanged (ownership table is generic)

### S2: EPIC_INDEX Reset

**AC**:
- [ ] `docs/epics/EPIC_INDEX.md` — clean template with:
  - Empty Phase 0 table (user's first epic)
  - Clean dependency rules section (empty)
  - Clean phase parallelism section (empty)
  - "Next Action: Run `/athena:plan` to propose your first epics"
- [ ] All `docs/epics/e*` spec files deleted (project-specific)
- [ ] `docs/epics/CLAUDE.md` — unchanged (conventions are generic)

### S3: Template State Stored for Reset

**AC**:
- [ ] Template-ready versions stored in `docs/templates/context/` (for reset script to copy from)
- [ ] Reset script (E69) uses these as source of truth
- [ ] Git tracks both: current state (for this project) and template state (for clones)

## Risk Notes

- This epic produces the "clean slate" that E69's reset script copies into place
- Must coordinate with E69 on file paths
- Current project state preserved in git history (not lost)
