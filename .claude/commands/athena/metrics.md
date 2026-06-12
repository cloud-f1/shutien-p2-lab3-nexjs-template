---
description: "(planning) Read-only audit metrics → agent reliability or memory dashboard (--memory). No side effects."
allowed-tools: Read, Bash
---

# /athena:metrics — Agent Reliability + Memory Metrics

Read-only aggregation over `.claude/audit.jsonl`.

- **Default mode** (no `--memory`): emits a markdown table of per-agent
  statistics from `agent_complete` events. Answers *"which agents are flaky?"*
  before tuning the harness.
- **Memory mode** (`--memory`): emits the Phase 45 memory dashboard
  (E186) — top-N retrieved lessons, strength histogram, per-agent citation
  map, archive churn, strength activity, SessionStart inject hit-rate, and
  premature-promotion candidate count. Answers *"is the Tier 0 memory loop
  healthy?"*

This command has **NO side effects**. Never write, edit, or create files.
Never run git operations. The only bash commands you may execute are the
`jq` / `date` pipelines described below or the `scripts/memory/metrics.sh`
script (which is itself read-only).

## Argument Parsing

Parse `$ARGUMENTS` for these flags:

| Flag | Example | Default | Description |
|------|---------|---------|-------------|
| `--epic E{n}` | `--epic E146` | (none) | Only include events whose `.epic` equals the given ID |
| `--since YYYY-MM-DD` | `--since 2026-04-01` | (none) | Only include events whose `.ts >= YYYY-MM-DDT00:00:00Z` |
| `--memory` | `--memory` | (off) | Switch to the memory dashboard (E186). Composes with `--epic` and `--since`. |
| `--top N` | `--top 5` | `10` | (memory mode only) Top-N retrieved lessons in the leaderboard. |
| `--effort` | `--effort` | (off) | Append the E199 effort metrics section: tier distribution, coverage-drop frequency, and effort-vs-review_loop verdict correlation. Composes with all other flags. |

Flags may appear in any order. Unrecognized flags should be reported back
to the user with a short usage hint.

## Memory Mode (`--memory`)

When `--memory` is present, **delegate to the read-only aggregator** instead
of running the agent-reliability pipeline:

```bash
scripts/memory/metrics.sh \
  ${EPIC:+--epic "$EPIC"} \
  ${SINCE:+--since "$SINCE"} \
  ${TOP:+--top "$TOP"}
```

Print the script's stdout verbatim (it is already formatted markdown). The
script:

- Reads `.claude/audit.jsonl` for `tier0_loaded` / `rule_fired` /
  `agent_cited` / `strength_reinforced` / `strength_decayed` /
  `lesson_archived` / `lesson_revived` events
- Reads `~/.claude/template-memory/*.md` frontmatter for the strength
  histogram (delegates to `scripts/memory/score.sh get` so the parser never
  drifts)
- Shells to `scripts/memory/promotion-follow-through.sh --json | jq length`
  for the stale-promotion count
- Honors `--epic` and `--since` filters across every section
- NEVER writes to Tier 0 lesson files
- Add `--json` for machine-readable output

The remainder of this document describes the **default mode** (agent
reliability).

## Protocol

### Step 1 — Locate audit log

```bash
AUDIT_LOG=".claude/audit.jsonl"
```

Guardrail checks:

- If the file does not exist → print `No agent metrics recorded yet.` and STOP.
- If the file exists but is empty (`! [ -s "$AUDIT_LOG" ]`) → print
  `No agent metrics recorded yet.` and STOP.
- If no line in the file has `.event == "agent_complete"` → print
  `No agent metrics recorded yet.` and STOP.

### Step 2 — Build the jq filter

Start from the base selector:

```jq
select(.event == "agent_complete")
```

If `--epic E{n}` was provided, append:

```jq
| select(.epic == "E{n}")
```

If `--since YYYY-MM-DD` was provided, append:

```jq
| select(.ts >= "YYYY-MM-DDT00:00:00Z")
```

### Step 3 — Aggregate per agent

Run a single `jq -s` pipeline that groups the filtered rows by `.agent` and
computes the four summary columns:

```bash
jq -s --arg epic "$EPIC" --arg since "$SINCE" '
  map(select(.event == "agent_complete"))
  | map(select($epic == "" or .epic == $epic))
  | map(select($since == "" or .ts >= ($since + "T00:00:00Z")))
  | group_by(.agent)
  | map({
      agent: .[0].agent,
      runs: length,
      successes: map(select(.status == "success")) | length,
      failures: map(select(.status == "failure")) | length,
      partials: map(select(.status == "partial")) | length,
      avg_duration_s: ((map(.duration_s // 0) | add) / length),
      total_retries: (map(.retries // 0) | add)
    })
  | map(. + {success_pct: ((.successes * 100) / .runs | floor)})
  | sort_by(-.runs)
' "$AUDIT_LOG"
```

If the resulting array is empty after filters are applied → print
`No agent metrics match the given filters.` and STOP.

### Step 4 — Render markdown table

Format `avg_duration_s` as human-friendly:

- `< 60` → `{N}s`
- `60–3599` → `{M}m {S}s`
- `>= 3600` → `{H}h {M}m`

Emit exactly this structure (no extra commentary above the header):

```
# Agent Metrics

Source: .claude/audit.jsonl
Filters: epic={EPIC or "all"}, since={SINCE or "all-time"}
Window: {N} agent_complete events across {M} agents

| Agent          | Runs | Success % | Avg Duration | Total Retries |
|----------------|------|-----------|--------------|---------------|
| debugger       |   12 |    75%    | 3m 20s       |       4       |
| qa             |   18 |    94%    | 1m 45s       |       1       |
| spec-writer    |    7 |   100%    |    45s       |       0       |
```

Sort rows by `runs DESC`, tiebreak by `agent` alphabetical.

### Step 5 — Tail summary

Below the table, include a one-line overall summary:

```
Overall: {total_runs} runs — {total_success_pct}% success, {total_retries} retries across {agent_count} agents.
```

Where:
- `total_runs` = sum of `runs`
- `total_success_pct` = `floor(sum(successes) * 100 / total_runs)`
- `total_retries` = sum of `total_retries`
- `agent_count` = number of groups

## Examples

```
/athena:metrics
/athena:metrics --epic E146
/athena:metrics --since 2026-04-01
/athena:metrics --epic E146 --since 2026-04-01

# Memory dashboard (E186) — Phase 45 audit-event aggregation
/athena:metrics --memory
/athena:metrics --memory --top 5
/athena:metrics --memory --since 2026-04-01
/athena:metrics --memory --epic E180 --since 2026-04-01

# Effort metrics (E199) — coverage-drop frequency + tier correlation
/athena:metrics --effort
/athena:metrics --memory --effort
/athena:metrics --effort --since 2026-06-01
```

### Brainstorm context retrievals (E189)

Count of `tier0_loaded` events with `context=brainstorm` in `.claude/audit.jsonl`, last 30 days:

```bash
jq -r 'select(.event=="tier0_loaded" and .context=="brainstorm" and .ts >= "'$(date -u -v-30d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u --date='30 days ago' +%Y-%m-%dT%H:%M:%SZ)'") | .lesson' .claude/audit.jsonl 2>/dev/null | sort | uniq -c | sort -rn | head -5
```

Top-5 most-retrieved lessons during brainstorm. Empty output means no brainstorm sessions yet or no matches found.

### Step 6 — Pipeline Events Summary (E193)

After the agent-reliability table, include a pipeline-events aggregate block.
This section counts `commit`, `merge`, and `qa_result` events — the primary
observability substrate wired by E193. If none exist yet, print a short hint.

```bash
jq -s --arg since "${SINCE:-}" '
  map(
    select(.event == "commit" or .event == "merge" or .event == "qa_result")
    | select($since == "" or .ts >= ($since + "T00:00:00Z"))
  )
  | {
      commit_count:   map(select(.event=="commit"))   | length,
      merge_count:    map(select(.event=="merge"))    | length,
      qa_pass_count:  map(select(.event=="qa_result" and .verdict=="pass")) | length,
      qa_fail_count:  map(select(.event=="qa_result" and .verdict=="fail")) | length,
      epics_committed: [map(select(.event=="commit") | .epic // "?") | unique[]] | join(", "),
      epics_merged:    [map(select(.event=="merge")  | .epic // "?") | unique[]] | join(", ")
    }
' "$AUDIT_LOG"
```

Render as:

```
## Pipeline Events (E193)

| Event      | Count | Details                          |
|------------|-------|----------------------------------|
| commit     |   N   | epics: E193, E194, …             |
| merge      |   N   | epics: E193, E194, …             |
| qa_result  |   N   | pass: P  fail: F                 |
```

If all three counts are 0, print instead:
```
## Pipeline Events (E193)
No pipeline events recorded yet. Wire emit calls via:
  bash scripts/hooks/audit-emit-pipeline.sh <event> [key=value ...]
```

## Effort Mode (`--effort`) — E199

When `--effort` is present, append a **"Section: Effort Metrics (E199)"** block after
the existing output (memory dashboard or agent-reliability table). This section renders
three sub-sections from `audit.jsonl`:

```bash
scripts/memory/metrics.sh --effort
# or compose with memory mode:
scripts/memory/metrics.sh --memory --effort
```

The `--effort` flag is additive — it never replaces the default or `--memory` output.

### Sub-sections

**a. Effort Tier Distribution** — count of `effort_resolved` events grouped by `.tier`
(quick / standard / thorough / ultra). Answers: *"how is the team distributing effort across
tasks?"*

**b. Coverage-Drop Frequency (last 30 days)** — count of `coverage_dropped` events grouped
by `.tier` field, within the last 30-day window. Answers: *"which system tiers hit caps most
often?"*

**c. Effort vs review_loop Verdict Correlation** — joins `effort_resolved` + `review_loop`
events on epic; for each effort tier shows CONVERGED / STUCK / MAX_REACHED breakdown.
Answers: *"does higher effort produce better reviewer convergence?"*

**d. Effort Cost Proxy (E207)** — model-tier-weighted cost proxy per tier, sourced from the enriched
`effort_resolved` fields added in E207 (`model_map`, `max_concurrent`). Answers: *"ultra is ~Nx the
per-run cost of standard — is the depth worth it?"*

Cost proxy weights (relative units, NOT dollar amounts):

| Model | Weight |
|-------|--------|
| haiku | 1 |
| sonnet | 5 |
| opus | 25 |

Formula: `cost_proxy_per_run = (reviewer_weight + evaluator_weight) × max_concurrent`

**Backward compatibility**: pre-E207 `effort_resolved` events (lacking `model_map` / `max_concurrent`
fields) are **excluded from the cost-proxy sum** but still counted in the tier distribution. No crash,
no NaN — graceful degradation.

### Example output (including E207 sub-section)

```
## Section: Effort Metrics (E199)

### a. Effort Tier Distribution

| Effort Tier | Events |
|-------------|--------|
| standard    | 18     |
| thorough    | 7      |
| quick       | 3      |
| ultra       | 1      |

### b. Coverage-Drop Frequency (last 30 days)

| Tier          | Drops (30d) |
|---------------|-------------|
| orchestration | 3           |
| review        | 1           |

### c. Effort vs review_loop Verdict Correlation

| Effort Tier | CONVERGED | STUCK | MAX_REACHED | Total |
|-------------|-----------|-------|-------------|-------|
| thorough    | 5         | 1     | 1           | 7     |
| standard    | 11        | 4     | 3           | 18    |
| quick       | 1         | 2     | 0           | 3     |

### d. Effort Cost Proxy (E207)

_Relative weights: haiku=1 / sonnet=5 / opus=25. Formula: (reviewer_weight + evaluator_weight) × max_concurrent._
_These are relative proxies — not dollar amounts. Use for "ultra is ~Nx the per-run cost of standard" comparisons._

| Tier     | Invocations | Model Map                        | Max Concurrent | Cost Proxy/Run | Total Cost Proxy |
|----------|-------------|----------------------------------|----------------|----------------|------------------|
| ultra    | 1           | reviewer=opus,evaluator=opus     | 8              | 400            | 400              |
| thorough | 7           | reviewer=sonnet,evaluator=opus   | 4              | 120            | 840              |
| standard | 15          | reviewer=sonnet,evaluator=sonnet | 4              | 40             | 600              |
| quick    | 3           | reviewer=haiku,evaluator=sonnet  | 1              | 6              | 18               |
```

Empty-state messages are shown for each sub-section when the corresponding events are absent.

## Safety Rules

1. **NEVER** write, edit, or create any file — this command is read-only.
2. **NEVER** run `git`, `rm`, `mv`, or any state-mutating command.
3. Handle missing `.claude/audit.jsonl` gracefully — always print the
   empty-state message, never error out.
4. Only use `jq` and `date` — no new dependencies.
5. Keep output under 120 chars wide so it fits standard terminals.
