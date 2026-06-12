# E69 — Template Reset Script

> **Phase**: 21 | **Size**: S (5 SP) | **Priority**: P1
> **Depends on**: none
> **Branch**: `MH/feat/E69-template-reset`

---

## Problem Statement

A new user cloning this template inherits 600K of epic archives, 260K of design artifacts, session logs with alien PR numbers (#82–#91), and strategy cycle history. There's no single command to strip project-specific history and start clean.

## Solution

Create `scripts/template-reset.sh` — a one-time post-clone cleanup script that:
1. Deletes project-specific archives and history
2. Resets context docs to template-ready state
3. Removes the upgrade-stripe skill (project-specific)
4. Preserves the framework, agents, commands, and core skills

## Stories

### S1: Reset Script

**AC**:
- [ ] `scripts/template-reset.sh` — interactive with confirmation prompt
- [ ] Deletes: `docs/epics/archive/`, `docs/archive/`, all `docs/epics/e*` files
- [ ] Resets: `docs/context/epic-progress.md` → empty template (Phase 0 only)
- [ ] Resets: `docs/context/strategy-log.md` → blank Cycle 1 template
- [ ] Resets: `docs/context/session-summary.md` → starter template
- [ ] Resets: `docs/context/spec-log.md`, `review-log.md`, `debug-log.md`, `test-status.md`, `deploy-log.md`, `decisions.md` → empty headers only
- [ ] Deletes: `.claude/skills/upgrade-stripe.md`
- [ ] Removes backward-compat re-export shims in `server/app/models/portfolio.py`, `server/app/schemas/portfolio.py`, `server/app/api/v1/endpoints/portfolios.py`
- [ ] Prints summary of what was deleted/reset
- [ ] Exit code 0 on success

### S2: Makefile Integration

**AC**:
- [ ] `make reset` target runs the script
- [ ] Listed in `make help` with description "Reset template to clean state (run once after cloning)"
- [ ] Guarded: refuses to run if `.git/refs/heads` has >1 branch (safety — don't run on active project)

### S3: README Reference

**AC**:
- [ ] README mentions `make reset` in the "Getting Started" section
- [ ] Brief note: "Run `make reset` after cloning to remove example project history"

## Risk Notes

- Destructive operation — confirmation prompt required
- Branch guard prevents accidental use on active projects
- Should be idempotent (safe to run twice)
