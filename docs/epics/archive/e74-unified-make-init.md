# E74 — Unified `make init` Flow

> **Phase**: 23 | **Size**: M (8 SP) | **Priority**: P1
> **Depends on**: E73
> **Branch**: `MH/feat/E74-unified-make-init`

---

## Problem Statement

Post-clone setup requires two disconnected commands (`make reset` + `./scripts/new-site.sh`) with no guidance on order. Most users skip `make reset` and go straight to `make go`, inheriting template-specific context docs, stale epic history, and placeholder names. There is no single "clone → customize → build" command.

## Stories

### S1: `make init` Target

**AC**:
- [ ] Add `make init` target to Makefile
- [ ] Chains: `reset` → `new-site` → `ensure-db` → `migrate` → `generate-types`
- [ ] Prints clear banner at start explaining what it does
- [ ] Creates `.initialized` sentinel file on success to prevent accidental re-runs
- [ ] `make init` warns and prompts if `.initialized` already exists
- [ ] Non-interactive mode: `make init ARGS="--skip-prompts"` uses defaults

### S2: Update Onboarding Docs

**AC**:
- [ ] README: reference `make init` as the primary post-clone command
- [ ] `make tutorial`: mention `make init` in first step
- [ ] `make help`: list `init` with description
- [ ] Getting-started page: update post-clone instructions

## Risk Notes

- `make init` calls `new-site.sh` which must be fixed first (E73 dependency)
- The `.initialized` sentinel prevents accidental data loss on re-run
- `make go` should remain unchanged — it's for daily development, not first-time setup
