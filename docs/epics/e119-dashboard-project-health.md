# E119 — Dashboard Project Health Summary

> Phase 31 — Integration Integrity Shield | Size: S | Deps: none
> Learned from: ai-finance-management full project stats + template dashboard gaps

## Problem

`/athena:dashboard` shows phase-level and epic-level detail but lacks project-wide health metrics: total completion %, coverage trends, failure/retry rates, and velocity. The finance project shows "122 epics · 40 phases · V2-V10: 117 complete" inline — a one-glance project health pulse that the template lacks.

## Solution

Enhance `/athena:dashboard` with a Project Health section at the top, before the existing phase/epic detail.

### New output block (prepended to dashboard):
```
═══ PROJECT HEALTH ══════════════════════════════

Epics:  {complete}/{total} ({pct}%)  ████████░░
Phases: {complete_phases}/{total_phases} complete
Tests:  {server_count} server + {client_count} client = {total_tests}
Agents: {agent_count} | Commands: {cmd_count} | Skills: {skill_count}

Recent:
  Last commit:  {sha} {message} ({age})
  Last batch:   Phase {N} Wave {W} — {status}
  Last deploy:  {date} — {status}

═════════════════════════════════════════════════
```

## Key Files

| File | Action |
|------|--------|
| `.claude/commands/athena/dashboard.md` | Add Project Health section |

## Acceptance Criteria

1. Dashboard prepends a Project Health block before existing phase/epic tables
2. Shows: epic completion % with progress bar, phase count, test counts, agent/command/skill counts
3. Shows recent activity: last commit, last batch result, last deploy status
4. Data derived from: `epic-progress.md` (epics/phases), `session-summary.md` (test counts), `orchestration-log.md` (last batch), `deploy-log.md` (last deploy), `git log` (last commit)
5. Fits in one terminal screen (~20 lines)
6. Works with `--json` flag (existing dashboard feature)
