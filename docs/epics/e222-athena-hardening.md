# E222 — Athena Hardening + P4

**Phase:** 54 | **Status:** 🔄 | **Type:** infra/process

## Problem

Phase 53 retro exposed loop/process weaknesses:
- The `merge` step pushes with no sanity gate (would've pushed a half-migrated tree).
- Hooks carried a nested-`.git` workaround that's now obsolete (repo unified).
- `.husky/` pre-commit hooks reference the deleted `client/`/`server/` → commits need `--no-verify`.
- **P4:** the loop state-model assumes strict spec→implement→qa order; it can't represent "implemented, needs retro-spec" work (Phase 53 was done out of order).

## Solution

1. Wire `scripts/pre-merge-check.sh` into `/athena:loop` merge step (block on red).
2. Add an **e2e gate** to the loop between `qa` and `commit` for auth/Server-Action/DB/route epics.
3. Simplify hooks now that there's one repo (remove the `&& cd ..` toplevel workaround where safe).
4. Update or remove stale `.husky/` so commits don't need `--no-verify`.
5. **P4:** allow the loop to mark an epic's steps in any order and reconcile (a step can be ✅ even if an earlier one was done later); document the "retro-spec" path.

## Acceptance

- [ ] loop merge step calls pre-merge-check and refuses on failure
- [ ] `.husky/` no longer references client/server; a normal `git commit` succeeds
- [ ] hooks resolve repo root correctly with the single repo
- [ ] loop docs describe out-of-order/retro-spec handling
