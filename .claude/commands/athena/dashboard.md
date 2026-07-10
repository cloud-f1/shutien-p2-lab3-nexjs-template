---
description: "(planning) Read-only pipeline dashboard → audit log + orchestration data → epic progress view."
allowed-tools: Read, Bash, Glob, Grep
---

# Pipeline Dashboard — Read-Only Progress View

You are the Pipeline Dashboard renderer. Your job is to read existing project data and render a formatted progress report. You have **NO side effects** — you never create, modify, or delete any files.

## Argument Parsing

Parse `$ARGUMENTS` for the following flags:

| Argument | Example | Default | Description |
|----------|---------|---------|-------------|
| `--phase N` | `--phase 26` | (none) | Filter to show only epics in phase N |
| `--json` | `--json` | off | Output machine-readable JSON instead of formatted tables |

If no arguments are provided, show the full dashboard for all phases.

## Protocol

### Step 1: Read Data Sources

Read these files (handle missing/empty gracefully — show "no data" sections):

1. **`docs/context/epic-progress.md`** — epic step matrix, phase status, dependency rules
2. **`docs/context/orchestration-log.md`** — batch execution history
3. **`.claude/audit.jsonl`** — JSONL audit log (may be empty or missing)
4. **`docs/context/session-summary.md`** — test counts, agent/command/skill counts
5. **`docs/context/deploy-log.md`** — deployment history

Also run:
- `git log --oneline -1` — latest commit (SHA + message)
- `git log --oneline -1 --format="%h %s (%ar)"` — with relative age

### Step 2: Parse Epic Status

From `epic-progress.md`, extract:

- **Phase Status table**: phase number, epic IDs, completion status
- **Epic Step Matrix**: per-epic step status (spec, impl, QA, commit, merge)
- **Dependency Rules**: which epics depend on which

Calculate per-epic completion:
- Count steps with status ✅ or ⏭️ as "done"
- Total steps = 5 (spec, impl, QA, commit, merge)
- Completion % = done / 5 * 100

### Step 3: Parse JSONL Audit Log

Read `.claude/audit.jsonl` line by line. Each line is a JSON object. Handle:
- Empty file → "No audit data available"
- Malformed lines → skip silently
- Missing file → "No audit log found"

Extract if available:
- Command invocations (command name, timestamp, duration)
- Agent results (epic ID, step, status, duration)
- Failure events (epic ID, step, error message)

### Step 4: Parse Orchestration Log

From `orchestration-log.md`, extract:
- Batch execution entries (date, phase, epic results)
- Wave progress data
- Active batch detection (look for entries without a completion marker)

### Step 5: Render Dashboard

If `--json` flag is set, skip to **JSON Output** section below.

#### 5a. Project Health Summary (always first)

Gather these values from the data sources read in Step 1:

- **Epics**: from `epic-progress.md`, count epics with all 5 steps ✅/⏭️ as complete; total = all epics listed
- **Phases**: count phases where all epics are 100% complete vs total phases
- **Tests**: from `session-summary.md`, extract the unit test count and the e2e status
  (this repo tracks one Vitest unit count + a green/red e2e signal — not separate
  server/client counts, which belonged to the removed FastAPI/Vite split)
- **Agents/Commands/Skills**: from `session-summary.md`, extract counts (or count
  files: `.claude/agents/*.md`, `.claude/commands/athena/*.md` for agents/commands;
  skills are one directory per skill, not a loose file — count with
  `ls -d .claude/skills/*/ | wc -l`)
- **Last commit**: from `git log` output
- **Last batch**: from `orchestration-log.md`, find the most recent batch entry — extract phase, wave, and status
- **Last deploy**: from `deploy-log.md`, find the most recent entry — extract date and status

Build a progress bar: 10 blocks total. Filled blocks = round(complete_epics / total_epics * 10). Use `█` for filled, `░` for empty.

Render:

```
═══ PROJECT HEALTH ══════════════════════════════

Epics:  {complete}/{total} ({pct}%)  ████████░░
Phases: {complete_phases}/{total_phases} complete
Tests:  {unit_count} unit · e2e {e2e_status}
Agents: {N} | Commands: {N} | Skills: {N}

Recent:
  Last commit:  {sha} {message} ({age})
  Last batch:   Phase {N} Wave {W} — {status}
  Last deploy:  {date} — {status}

═════════════════════════════════════════════════
```

If any data source is missing, show `—` for that field. Never error out.

#### 5b. Header

```
══════════════════════════════════════════════════════════════
  ATHENA PIPELINE DASHBOARD
  Generated: {YYYY-MM-DD HH:MM}
══════════════════════════════════════════════════════════════
```

#### 5c. Phase Summary (filtered by --phase if specified)

```
PHASE OVERVIEW
──────────────────────────────────────────────────────────────
Phase  │ Epics     │ Status       │ Completion
───────┼───────────┼──────────────┼──────────────
  0    │ E0        │ ✅ Complete   │ 100%
  1    │ E1–E3     │ ✅ Complete   │ 100%
  ...
  26   │ E87–E91   │ ⬜ Pending   │  20%
──────────────────────────────────────────────────────────────
```

Phase completion % = average of all epic completion %s in that phase.

#### 5d. Epic Status Table (for active/pending phases, or filtered phase)

```
EPIC DETAIL — Phase {N}
──────────────────────────────────────────────────────────────
Epic │ Name              │ Spec │ Impl │ QA  │ Cmit │ Mrge │ %
─────┼───────────────────┼──────┼──────┼─────┼──────┼──────┼────
E87  │ {name}            │  ✅  │  ⬜  │ ⬜  │  ⬜  │  ⬜  │ 20%
E88  │ {name}            │  ✅  │  ⬜  │ ⬜  │  ⬜  │  ⬜  │ 20%
E89  │ {name}            │  ✅  │  ⬜  │ ⬜  │  ⬜  │  ⬜  │ 20%
E90  │ {name}            │  ✅  │  ⬜  │ ⬜  │  ⬜  │  ⬜  │ 20%
E91  │ {name}            │  ⬜  │  ⬜  │ ⬜  │  ⬜  │  ⬜  │  0%
──────────────────────────────────────────────────────────────
```

To get epic names: read `docs/epics/EPIC_INDEX.md` and extract the name column for each epic ID. Keep names under 20 chars (truncate with `...` if needed).

When no `--phase` is specified, show detail for:
1. Any phase with status ⬜ Pending
2. Any phase with in-progress (🔄) epics
3. Skip fully complete phases (just show them in the Phase Summary)

#### 5e. Aggregate Metrics

```
AGGREGATE METRICS
──────────────────────────────────────────────────────────────
Total epics:        {N}
Completed:          {N} ({pct}%)
In progress:        {N}
Pending:            {N}
Failed:             {N}

Total phases:       {N}
Phases complete:    {N}
Current phase:      {N}
──────────────────────────────────────────────────────────────
```

If JSONL audit data is available, also show:
```
FROM AUDIT LOG
──────────────────────────────────────────────────────────────
Total commands:     {N}
Avg step duration:  {N}m
Failure rate:       {pct}%
Last activity:      {timestamp}
──────────────────────────────────────────────────────────────
```

If no audit data: show `Audit log: empty — no timing data available`

#### 5f. Wave Progress (for active batches)

Check orchestration-log.md for active batch entries. If found:

```
ACTIVE BATCH — Phase {N}
──────────────────────────────────────────────────────────────
Wave:       {current}/{total}
Running:    {N} agents
Completed:  {N} agents
Failed:     {N} agents
ETA:        ~{N}m (based on avg step duration)
──────────────────────────────────────────────────────────────
```

If no active batch:
```
BATCH STATUS
──────────────────────────────────────────────────────────────
No active batch.
Last batch: {date from most recent orchestration-log entry, or "none"}
──────────────────────────────────────────────────────────────
```

#### 5g. Footer

```
══════════════════════════════════════════════════════════════
  Tip: /athena:dashboard --phase 26    (filter to phase)
       /athena:dashboard --json        (machine-readable)
       /athena:loop                    (advance one step)
       /athena:batch --phase 26        (run phase in parallel)
══════════════════════════════════════════════════════════════
```

### JSON Output (`--json` flag)

When `--json` is specified, output a single JSON object (no markdown, no tables):

```json
{
  "generated_at": "2026-03-28T12:00:00Z",
  "filter": { "phase": null },
  "project_health": {
    "epics_complete": 86,
    "epics_total": 92,
    "epics_pct": 93,
    "phases_complete": 26,
    "phases_total": 27,
    "tests_unit": 327,
    "tests_e2e": "pass",
    "agents": "<count via: ls -1 .claude/agents/*.md | grep -v tmpl | wc -l>",
    "commands": "<count via: ls -1 .claude/commands/athena/*.md | wc -l>",
    "skills": "<count via: ls -d .claude/skills/*/ | wc -l>",
    "last_commit": { "sha": "8f1cd53", "message": "chore: Phase 29 complete", "age": "2 hours ago" },
    "last_batch": { "phase": 29, "wave": 2, "status": "complete" },
    "last_deploy": { "date": "2026-04-01", "status": "success" }
  },
  "phases": [
    {
      "phase": 0,
      "epics": ["E0"],
      "status": "complete",
      "completion_pct": 100
    }
  ],
  "epics": [
    {
      "id": "E0",
      "phase": 0,
      "steps": {
        "spec": "done",
        "implement": "done",
        "qa": "done",
        "commit": "done",
        "merge": "done"
      },
      "completion_pct": 100,
      "status": "complete"
    }
  ],
  "metrics": {
    "total_epics": 92,
    "completed": 86,
    "in_progress": 4,
    "pending": 1,
    "failed": 0,
    "total_phases": 27,
    "phases_complete": 26,
    "current_phase": 26
  },
  "audit": {
    "available": false,
    "total_commands": 0,
    "avg_step_duration_min": null,
    "failure_rate_pct": null,
    "last_activity": null
  },
  "active_batch": null
}
```

Map step statuses: ✅ → "done", ⏭️ → "skipped", 🔄 → "in_progress", ⬜ → "pending", ❌ → "failed"

If `--phase N` is specified, include `"filter": { "phase": N }` and only include matching phase/epics in the arrays.

## Safety Rules

1. **NEVER write, edit, or create any file** — this is a read-only command
2. **NEVER run any command that modifies state** — no git operations, no file writes
3. **Handle missing data gracefully** — always show something, never error out
4. **Keep output under 120 chars wide** — fits standard terminals
5. **Truncate long tables** — if showing all 90+ epics, summarize completed phases as one-liners
