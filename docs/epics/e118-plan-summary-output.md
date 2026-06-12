# E118 — Plan & Batch Summary Output Enhancement

> Phase 31 — Integration Integrity Shield | Size: S | Deps: none
> Learned from: ai-finance-management plan output (V11 BETA LAUNCH READINESS boxed summary)

## Problem

The template's `/athena:plan` outputs analysis text but no structured project summary. `/athena:batch` reports per-wave results but no project-wide context. ai-finance-management's plan command produces a polished boxed summary showing: phase title + status, epic list with sizes/points, wave execution order, FULL PROJECT stats (total epics, phases, complete vs pending), and NEXT action suggestions — all in one scannable block.

## Solution

Enhance `/athena:plan` and `/athena:batch` final output to include a project-wide summary block. Add a reusable summary format that both commands share.

### Plan output (after approval):
```
{PHASE_TITLE} — PLANNED ✅

Phase {N} — {theme} ({parallelism}):
    E{n}   {name}                    {size}  {SP}pts
    E{n}   {name}                    {size}  {SP}pts

Waves: [{wave1}] → [{wave2}] → [{wave3}]

FULL PROJECT:
    {total} epics · {phases} phases
    Phases 0-{last_complete}: {complete_count} complete
    Phase {current}: {pending_count} pending

NEXT:
    ! git push origin main
    /loop 2m /athena:batch auto → execute Phase {N}
```

### Batch output (after wave):
```
=== Phase {N} Wave {W}/{total} — {status} ===

  ✅ E{n} — {summary}
  ✅ E{n} — {summary}

PROJECT: {complete}/{total} epics · {complete_phases}/{total_phases} phases
NEXT WAVE: {next_wave_epics} | ETA: ~{estimate}m
```

## Key Files

| File | Action |
|------|--------|
| `.claude/commands/athena/plan.md` | Add summary output format after approval |
| `.claude/commands/athena/batch.md` | Add project stats to final report |

## Acceptance Criteria

1. `/athena:plan` outputs boxed summary after epic approval (phase, epics with sizes, waves, project stats, next actions)
2. `/athena:batch` final report includes project-wide stats (total epics/phases, complete/pending counts)
3. Both commands show `NEXT:` section with actionable commands
4. Summary data derived from `epic-progress.md` Phase Status table (no new state files)
5. Format is scannable in <5 seconds (no scrolling needed for summary block)
