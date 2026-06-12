# E2: Agent Loop + Commands — Spec

> **Goal**: Validate existing athena commands (loop/ship/learn), Makefile, and cache tier alignment. No new code — this is a validation + documentation epic.

## Current State

All components already exist:
- 11 athena commands in `.claude/commands/athena/`
- 6 agents in `.claude/agents/`
- Makefile with 14 targets (dev, setup, test, lint, db, migrate, help)
- Cache config REALTIME tier at 5s stale / 1min gc / 10s refetch
- Hook infrastructure: 8 hook types in `.claude/settings.json`

## No OpenAPI Changes

E2 is tooling-only — no API endpoints affected.

## Validation Checklist

### 1. `/athena:loop` — Epic Orchestrator
- [ ] Reads EPIC_INDEX.md and determines correct next step
- [ ] Executes exactly ONE step per invocation
- [ ] Respects dependency rules (won't start E3 before E1 merge)
- [ ] Phase boundary pause works (stops after all phase epics done)
- [ ] Error recovery: updates EPIC_INDEX with ❌ on failure
- [ ] `auto` argument suppresses phase pause
- [ ] `status` argument shows state without executing
- **Validated by**: E0 and E1 full pipeline runs (spec→merge)

### 2. `/athena:ship` — Quick Publish
- [ ] Detects changed files via `git status` + `git diff`
- [ ] Fixes only quality issues (typos, formatting) — not scope
- [ ] Commits with Conventional Commits format (zh-TW)
- [ ] On main: pushes directly, no PR
- [ ] On feature branch: pushes + creates PR
- **Validated by**: E0/E1 commit steps used this flow

### 3. `/athena:learn` — Memory Refresh
- [ ] Reads MEMORY.md + session-summary.md + EPIC_INDEX.md
- [ ] Detects stale facts (wrong epic status, outdated paths)
- [ ] Updates MEMORY.md with corrections
- [ ] Scans for [GENERALIZABLE] tags
- [ ] Suggests `/athena:promote` but never auto-runs it

### 4. Makefile Targets
- [ ] `make dev` — runs server + client concurrently
- [ ] `make test` — pytest + vitest with coverage
- [ ] `make lint` — ruff + tsc
- [ ] `make db` — Docker compose up
- [ ] `make setup` — full first-time setup (uv + pnpm)
- [ ] `make migrate` — alembic upgrade head

### 5. Cache Tier Sync
- [x] REALTIME: staleTime 5s, gcTime 1min, refetchInterval 10s ✓
- [x] STATIC: 60min, SEMI_DYNAMIC: 15min, SECURITY: 5min ✓

## Implementation Plan

Since everything exists, the "implement" step is:
1. Run `/athena:learn` once to validate drift detection
2. Run `make test` to validate Makefile test target
3. Run `make lint` to validate Makefile lint target
4. Verify cache config values match spec

## Test Plan

- All existing 121+ client tests still pass
- All existing 28+ server tests still pass
- Makefile targets execute without errors
- `/athena:learn` produces accurate MEMORY.md updates

## Acceptance Criteria

- [ ] Loop/ship/learn commands validated through actual use (E0+E1 cycles)
- [ ] Makefile targets verified working
- [ ] Cache tiers confirmed aligned
- [ ] No regressions in test suites
