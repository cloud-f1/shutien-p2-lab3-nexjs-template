# E145 — Context Health Monitor

> Phase 37 — Harness Engineering | Size: S (3 SP) | Deps: none

## Problem

Long Claude Code sessions suffer from context degradation — agents lose accuracy as the context window fills, causing mistakes that surface late (caught by stop verifier → fix → retry cycles). There's no proactive signal to restart a session with a fresh agent before quality drops. Anthropic's "Context Reflect" pattern: restart with a clean agent is more effective than compressing history.

## Solution

A PostToolUse hook (`context-health-monitor.sh`) that reads cumulative session metrics from `.claude/audit.jsonl` and injects context-window warnings as `additionalContext`. Because bash hooks can't introspect Claude's actual token count, we use measurable proxies: cumulative tool-call count and total bytes read. Thresholds map conceptually to the 70% / 85% targets.

## Key Files

| File | Action |
|------|--------|
| `scripts/hooks/context-health-monitor.sh` | New — PostToolUse hook, reads audit.jsonl, emits warnings |
| `.claude/settings.json` | Edit — register new hook under `PostToolUse` matcher `.*` |
| `scripts/hooks/CLAUDE.md` | Edit — document hook behavior + thresholds |

## Acceptance Criteria

1. `context-health-monitor.sh` parses `.claude/audit.jsonl` on each PostToolUse invocation
2. Computes cumulative counters: `tool_calls` (line count) + `bytes_read` (sum of file sizes from `tool_input.file_path`)
3. **Yellow warning** (~70% proxy): `tool_calls >= 200` OR `bytes_read >= 500000` → stdout: "⚠️ Session context filling up ({calls} calls, {KB} KB read). Consider `/athena:save` to checkpoint."
4. **Red warning** (~85% proxy): `tool_calls >= 400` OR `bytes_read >= 1000000` → stdout: "🔴 Session context critical ({calls} calls, {KB} KB). Recommend `/athena:save` + fresh agent handoff."
5. Warnings are non-blocking (always exit 0)
6. Handles missing/empty audit.jsonl gracefully (exits silently with 0)
7. Unit-testable: hook accepts a fixture audit.jsonl path via `$AUDIT_LOG_PATH` env var for test injection
8. Suppress duplicate warnings within same threshold tier (track last-emitted tier in `.claude/.health-state`)

## Out of Scope

- No e2e tests (hook is standalone bash, verified via fixture-driven unit tests)
- No `/athena:audit` integration
