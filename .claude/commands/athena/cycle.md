---
description: "(planning) Full DevOps cycle → brainstorm → approve → execute → reflect → cooldown. Human gates at approve + cooldown."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# /athena:cycle — Full DevOps Cycle Orchestrator

Single command that orchestrates the full plan → approve → execute → reflect cycle.

## Usage

Parse $ARGUMENTS:

```
/athena:cycle              # Start a new cycle (or resume current)
/athena:cycle status       # Show current cycle state
/athena:cycle continue     # Resume after cooldown pause
```

## Cycle State Machine

```
IDLE → PLANNING → AWAITING_APPROVAL → EXECUTING → REFLECTING → COOLDOWN → IDLE
```

State is persisted in `docs/context/strategy-log.md` under `## Current Cycle`.

## Protocol

### Phase 1: PLAN
1. Read strategy-log.md for current state
2. If state is IDLE or no current cycle: set state to PLANNING
3. Ask the user for a feature idea or area to improve, then run `/athena:plan brainstorm "<feature description>"` (E187 — dialogue-driven proposal via @strategist Brainstorm Mode). Fall back to `/athena:plan auto` (audit-driven) only if the user has no specific feature idea.
4. Set state to AWAITING_APPROVAL
5. **STOP** — report proposals and wait for human input

### Phase 2: APPROVE (human gate — MANDATORY)
- User runs `/athena:plan approve E{n},E{m}` (or reject/defer)
- After approval: set state to EXECUTING
- **This phase ALWAYS requires human interaction — NEVER skip**

### Phase 3: EXECUTE
1. Run `/athena:loop auto` for all approved epics. For more than one epic, the
   recommended multi-epic pattern is `/loop 2m /athena:batch auto` (cron-driven
   parallel wave dispatch, auto-falls-back to sequential) alongside/instead of a
   single `/athena:loop auto` call.
2. Monitor for failures (QA < 80%, implementation errors)
3. If failure: set state to COOLDOWN with failure report, STOP
4. If all epics complete: set state to REFLECTING

### Phase 4: REFLECT
1. @strategist reviews what was built:
   - Which epics succeeded/failed?
   - What lessons learned?
   - Any new weaknesses introduced?
2. Update strategy-log.md with cycle results
3. Run `/athena:promote` if generalizable lessons found
4. Set state to COOLDOWN

### COOLDOWN
- **STOP** — report cycle summary
- "Cycle {N} complete. {X} epics shipped. Run `/athena:cycle continue` for next cycle."
- **NEVER auto-advance past cooldown**

## Safety Boundaries

```
Max epics per cycle:        5
Max points per cycle:       80
Human gate:                 MANDATORY (Phase 2)
Cooldown:                   MANDATORY (Phase 4 → IDLE)
Context guard:              60% → /athena:save and STOP
Self-modification:          PROHIBITED
Scope changes mid-cycle:    PROHIBITED
CRITICAL CVE bypass:        Security issues only (notify, don't auto-fix)
```

## Budget Enforcement

```
if proposed_epics > 5:
    trim to top 5 by priority
    log remainder to "Deferred Ideas"

if total_points > 80:
    warn "cycle budget exceeded"
    trim lowest-priority epics until under 80

if phase == AWAITING_APPROVAL:
    STOP — do not proceed without human input

if phase == COOLDOWN:
    STOP — report cycle summary
    "Cycle {N} complete. {X} epics shipped. Run /athena:cycle continue for next cycle."

if context > 60%:
    /athena:save and STOP
```

## State Persistence Format (in strategy-log.md)

```markdown
## Current Cycle

| Field | Value |
|-------|-------|
| Cycle | {N} |
| State | {IDLE/PLANNING/AWAITING_APPROVAL/EXECUTING/REFLECTING/COOLDOWN} |
| Started | {ISO date} |
| Mode | {auto/research/audit/...} |
| Approved Epics | {E60, E61, ...} |
| Completed | {E60 ✅, E61 🔄, ...} |
```

## Status Command

When `$ARGUMENTS` is `status`:
1. Read strategy-log.md
2. Report current cycle state, phase, approved epics, progress
3. Do NOT execute any actions
