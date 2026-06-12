# E146 — Agent Metrics + /athena:metrics

> Phase 37 — Harness Engineering | Size: M (4 SP) | Deps: E145

## Problem

The harness has no quantitative visibility into agent-level reliability. We can't tell if `@debugger` fails 40% of the time vs 5%, which blocks data-driven harness improvements. The audit.jsonl captures bash commands but not agent outcomes (success/failure, duration, retries). Without these signals, harness tuning relies on intuition.

## Solution

Extend the existing `subagent-stop-writeback.sh` hook to also emit an `agent_complete` JSON event to `.claude/audit.jsonl`. Create a new `/athena:metrics` slash command that reads audit.jsonl and aggregates per-agent statistics (runs, success rate, avg duration, total retries).

## Key Files

| File | Action |
|------|--------|
| `scripts/hooks/subagent-stop-writeback.sh` | Edit — append `agent_complete` event to audit.jsonl |
| `.claude/commands/athena/metrics.md` | New — slash command definition + aggregation logic |
| `scripts/hooks/CLAUDE.md` | Edit — document `agent_complete` event schema |

## Acceptance Criteria

1. `subagent-stop-writeback.sh` appends a JSON line on every SubagentStop:
   ```json
   {"ts":"2026-04-09T12:00:00Z","event":"agent_complete","agent":"debugger","epic":"E145","status":"success","duration_s":180,"retries":0}
   ```
2. `status` field derived from: `success` by default, `failure` if stop-verifier blocked, `partial` if retries > 0
3. `duration_s` computed from agent start timestamp (tracked via a companion `agent_start` event or hook input)
4. `/athena:metrics` slash command exists at `.claude/commands/athena/metrics.md`
5. Command reads `.claude/audit.jsonl`, filters `.event == "agent_complete"`, groups by `agent` field via `jq`
6. Output: markdown table with columns — `agent`, `runs`, `success %`, `avg duration`, `total retries`
7. Supports `--epic E{n}` flag to filter by specific epic
8. Supports `--since YYYY-MM-DD` flag to filter by time range
9. Handles missing or empty audit.jsonl gracefully ("No agent metrics recorded yet.")
10. No new dependencies (pure bash + jq)

## Out of Scope

- No e2e tests (unit-verified via fixture audit.jsonl)
- No `/athena:audit` integration or cross-validation
- No historical trend tracking across sessions (audit.jsonl is per-session/gitignored)
