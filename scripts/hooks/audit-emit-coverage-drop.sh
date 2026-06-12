#!/bin/bash
# audit-emit-coverage-drop.sh — emit a `coverage_dropped` event to .claude/audit.jsonl
#
# Usage:
#   audit-emit-coverage-drop.sh <what> <reason> <tier>
#
# Arguments:
#   what     string   What capability was capped (e.g. batch_concurrency, reviewer_loop, metrics_top_n)
#   reason   string   Why the cap was hit (e.g. worktree_isolation_broken, MAX_ITERATIONS_reached)
#   tier     string   System tier where the cap occurred (e.g. orchestration, review, memory)
#
# Environment overrides (for tests):
#   AUDIT_LOG_PATH   Override .claude/audit.jsonl path
#   CLOCK_TS         Override timestamp (ISO 8601, for fixture tests)
#
# Examples:
#   audit-emit-coverage-drop.sh batch_concurrency worktree_isolation_broken orchestration
#   audit-emit-coverage-drop.sh reviewer_loop MAX_ITERATIONS_reached review
#   audit-emit-coverage-drop.sh metrics_top_n sample_cap_hit memory
#
# The emitted event:
#   {"ts":"...","event":"coverage_dropped","what":"batch_concurrency","reason":"worktree_isolation_broken","tier":"orchestration"}
#
# Callers must append `|| true` so that even a missing `jq` or unwritable log
# cannot propagate a non-zero exit into the pipeline. This helper emits NOTHING
# and exits non-zero if any required argument is missing.

set -euo pipefail

WHAT="${1:-}"
REASON="${2:-}"
TIER="${3:-}"

# Validate: all three args are required. Exit non-zero with NO output if any is missing.
if [ -z "$WHAT" ] || [ -z "$REASON" ] || [ -z "$TIER" ]; then
  echo "Usage: audit-emit-coverage-drop.sh <what> <reason> <tier>" >&2
  exit 1
fi

# Resolve repo root (best-effort; fall back to cwd)
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" 2>/dev/null || true

AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true

# Timestamp (overridable for tests)
TS="${CLOCK_TS:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

# Require jq — it's a hard dep for the audit log infrastructure
if ! command -v jq >/dev/null 2>&1; then
  echo "audit-emit-coverage-drop.sh: jq not found — cannot emit audit event" >&2
  exit 1
fi

# Emit the JSONL line using jq -n -c (mirrors E180 audit-emit pattern)
jq -n -c \
  --arg ts "$TS" \
  --arg event "coverage_dropped" \
  --arg what "$WHAT" \
  --arg reason "$REASON" \
  --arg tier "$TIER" \
  '{ts:$ts,event:$event,what:$what,reason:$reason,tier:$tier}' \
  >> "$AUDIT_LOG"

echo "coverage_dropped emitted: what=$WHAT reason=$REASON tier=$TIER ts=$TS" >&2
