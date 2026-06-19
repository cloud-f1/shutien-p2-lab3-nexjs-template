---
description: "(planning) @strategist analysis → epic proposals → human approval gate. Use `brainstorm "<idea>"` for dialogue-driven design."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebSearch, WebFetch
---

# /athena:plan — Strategic Planning Command

Invoke @strategist agent to analyze and propose epics. All proposals require human approval.

## Usage

Parse $ARGUMENTS for mode:

```
/athena:plan research     # Competitor + industry analysis
/athena:plan audit        # Codebase weakness scan
/athena:plan comply       # Compliance gap analysis (OWASP + WCAG)
/athena:plan evolve       # Dependency + security scan
/athena:plan auto         # All modes, prioritized output
/athena:plan brainstorm "feature idea"  # Design dialogue → enriched epic proposal (E187)
/athena:plan mockup <path>              # Ingest HTML/Claude-Design handoff → UI-ready epics (E303)
/athena:plan status       # Show current strategy-log state (no analysis)
/athena:plan approve E{n},E{m}  # Approve specific proposed epics
/athena:plan reject E{n}        # Reject with reason
/athena:plan defer E{n}         # Move to "Deferred Ideas"
```

Default mode (no argument): `auto`

## Mockup Mode (UI-readiness from an HTML handoff)

If `$ARGUMENTS` starts with `mockup`, invoke the **`mockup-to-epics`** skill and follow its
pipeline against the bundle at the given path (a Claude-Design handoff: README + `project/`
HTML prototypes + source + optional PRD/domain doc):

1. Read the handoff README + PRD + domain doc (the rules SSOT).
2. Run + "play" the prototype and screenshot every screen × role + key modals + mobile
   (`node scripts/mockup/shot.cjs <html> <out-dir> [tour.json]`); persist shots in-repo.
3. Read each screen's source in full (parallelize with subagents for many screens).
4. Inventory the codebase for reuse (`<DataTable>`, `<Dialog>`, `<ConfirmDialog>`, existing
   RBAC helpers in `lib/is-admin.ts`); surface conflicts via `AskUserQuestion` before writing.
5. Propose the epic list + DAG (normal plan output), then enrich each UI epic to the
   `docs/epics/_templates/ui-spec-epic.md` depth: route/data, layout, component tree,
   field·validation·copy tables, table/list column+filter+sort+pagination specs, RBAC
   matrix, mutations→revalidatePath, **style mapping → shadcn/Tailwind**, states, AC.

The goal: an epic a build agent can implement **pixel-aligned without opening the mockup**.
Worktree caveat: epics that run `npx shadcn add` / add deps / add colliding migrations are
not `/athena:flow` worktree-safe — run them in-repo.

## Step 1 — Status Check (all modes)

Read `docs/context/strategy-log.md`. If a cycle is in AWAITING_APPROVAL state:
- Report pending proposals
- Prompt: "Pending proposals exist. Run `/athena:plan approve` or `/athena:plan reject` first."
- STOP (unless mode is `approve`, `reject`, `defer`, or `status`)

## Step 2 — Analysis (research/audit/comply/evolve/auto)

Invoke @strategist agent with the selected mode. Use the Agent tool:
- Read `.claude/agents/strategist.md` for full @strategist instructions
- Execute the selected mode analysis following the agent's workflow
- Ensure all required context files are read before analysis

## Step 2.5 — Brainstorm Mode (E187)

If `$ARGUMENTS` starts with `brainstorm`:

1. Extract the feature idea string: everything after `brainstorm ` (strip surrounding quotes).
2. Spawn `@strategist` via the Agent tool with prompt:
   - "Run brainstorm protocol for feature idea: `{idea}`. Read `.claude/agents/strategist.md` § Brainstorm Mode. Conduct Q&A dialogue with the user; capture phases, checkpoints, test_strategy, dependencies, risks. When user approves the design, emit the result as a JSON file at `/tmp/brainstorm-<epic>.json` matching the schema in `scripts/plan/brainstorm-emit.sh` header."
3. After @strategist returns with a written JSON path:
   - Run: `./scripts/plan/brainstorm-emit.sh strategy-log /tmp/brainstorm-<epic>.json`
   - Verify exit 0
4. Report to user:
   - "Brainstorm complete. Epic E{n} proposed in `docs/context/strategy-log.md`. Run `/athena:plan approve E{n}` to render the enriched epic file."
5. STOP (do not proceed to approval — user must approve explicitly).

## Step 3 — Review Output

After @strategist writes to strategy-log.md:
- Verify max 5 proposals, max 80 points total
- Verify each proposal has: name, priority, points, rationale
- Report summary to user
- STOP — await human decision

## Approval Flow (`approve` / `reject` / `defer`)

### approve E{n},E{m},...

For each approved epic number:
1. Read the proposal from strategy-log.md
2. Create the epic file:
   - **If the proposal row has "(brainstorm)" suffix in its heading** (indicates brainstorm mode):
     - Locate the brainstorm JSON at `/tmp/brainstorm-E{n}.json` (or wherever @strategist wrote it; if absent, reconstruct from the strategy-log row)
     - Run: `./scripts/plan/brainstorm-emit.sh render-epic /tmp/brainstorm-E{n}.json`
     - This writes the enriched epic file with Implementation Phases / Per-Phase Checkpoints / Test Strategy sections
   - **Otherwise** (legacy / non-brainstorm modes):
     - Create `docs/epics/e{n}-{slug}.md` with the existing template (Problem / Solution / Key Files / Implementation / AC / Cross-Epic / Out of Scope)
3. Add row to `docs/context/epic-progress.md` (all steps ⬜)
4. Add row to `docs/epics/EPIC_INDEX.md`
5. Update strategy-log.md: mark as APPROVED with timestamp

After all approved epics are created, output a **boxed project summary** by reading `docs/context/epic-progress.md` Phase Status table:

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

Where:
- `{total}` = count of all epic IDs across all phases in the Phase Status table
- `{phases}` = count of all phase rows in the Phase Status table
- `{complete_count}` = count of epics in phases marked ✅ Complete
- `{pending_count}` = count of epics in phases marked ⬜ Pending
- `{last_complete}` = highest phase number with ✅ Complete status
- `{current}` = the phase number just planned
- Wave info comes from `scripts/epic-graph.sh --phase {N} --pending-only --json` if available, or from the phase's parallelism notes

Report: "Approved {N} epics. Run `/athena:loop` to begin execution."

### approve all

Same as above for all proposed epics in the current cycle.

### reject E{n}

1. Check if $ARGUMENTS includes a reason after the epic number (e.g., `/athena:plan reject E61 "scope too large"`)
2. If no reason provided: use default reason "Rejected by human reviewer — no reason specified"
3. Update strategy-log.md: mark as REJECTED with reason and timestamp
4. Log to "Completed Cycles" section

### defer E{n}

1. Move proposal to "Deferred Ideas" section in strategy-log.md
2. Add timestamp and brief note
3. Report: "Deferred E{n}. Will be reconsidered in future cycles."

## Budget Enforcement

```
if proposed_epics > 5:
    trim to top 5 by priority
    log remainder to "Deferred Ideas" automatically

if total_points > 80:
    warn user "cycle budget {pts}/80 exceeded"
    suggest removing lowest-priority epic
```

## Safety Rules

- NEVER create epic files without human approval
- NEVER modify epic-progress.md during analysis (only during approve)
- NEVER bypass the approval gate
- ALWAYS write analysis results to strategy-log.md
- ALWAYS stop and report after analysis
