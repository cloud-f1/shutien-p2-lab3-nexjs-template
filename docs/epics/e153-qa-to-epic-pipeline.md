# E153 — QA-to-Epic Pipeline

> Phase 38 — Cross-Project Extraction | Size: M (5 SP) | Deps: E148
> Source: ai-casino-shift Phase 39 QA cycle pattern

## Problem

QA phases discover bugs, but there's no structured path from "bug found" to "epic created". In casino-shift, QA Phase 2 found 26 bugs and manually created 9 epics (E223-E231). This manual translation is error-prone — bugs get lost, duplicated, or under-scoped.

## Solution

Create `/athena:qa-report` command that:

1. Reads `docs/context/bugfix-log.md` for unresolved entries
2. Groups bugs by severity and domain
3. Generates epic proposals (title, problem statement, size estimate)
4. Outputs to `docs/context/qa-report.md` for human review
5. After approval, appends new epics to `EPIC_INDEX.md`

## Key Files

| File | Action |
|------|--------|
| `.claude/commands/athena/qa-report.md` | New — command definition |
| `docs/context/qa-report.md` | New — auto-generated report (created by command) |
| `docs/epics/e153-qa-to-epic-pipeline.md` | New — this spec |

## Acceptance Criteria

1. Command reads `bugfix-log.md` and filters entries with `_(pending)_` root cause
2. Groups bugs into proposed epics (related bugs → single epic)
3. Each epic proposal includes: title, problem, affected files, size estimate (S/M/L)
4. Output is human-readable markdown — not auto-committed
5. Human gate: user must approve before epics are added to index
6. Command is idempotent — re-running updates report, doesn't duplicate
7. Integrates with E148 (bugfix-log hook) as input source

## Design Notes

- Casino-shift pattern: QA phase → bug report → manual epic creation → next phase
- This formalizes the "manual" step into a command with human gate
- Works best in projects with regular QA phases (every 3-5 development phases)
- Depends on E148 for structured bugfix-log input
