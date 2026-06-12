#!/bin/bash
# audit-emit-pipeline.sh — emit a pipeline-boundary event to .claude/audit.jsonl
#
# Usage:
#   audit-emit-pipeline.sh <event> [key=value ...]
#
# Arguments:
#   event        string   Event name (e.g. commit, merge, qa_result, review_loop,
#                         autopilot_advance, autopilot_pause)
#   key=value    pairs    Zero or more additional fields to merge into the JSON object.
#                         Values are always emitted as strings. Field names must be
#                         shell-safe identifiers (no spaces, no quotes).
#
# Environment overrides (for tests):
#   AUDIT_LOG_PATH   Override .claude/audit.jsonl path
#   CLOCK_TS         Override timestamp (ISO 8601, for fixture tests)
#
# Examples:
#   audit-emit-pipeline.sh commit epic=E193 sha=abc1234
#   audit-emit-pipeline.sh merge epic=E193 pr=176
#   audit-emit-pipeline.sh qa_result epic=E193 coverage=92.1 verdict=pass
#   audit-emit-pipeline.sh review_loop epic=E193 rounds=2 verdict=CONVERGED
#   audit-emit-pipeline.sh autopilot_advance epic=E193 step=implement score=0.87
#   audit-emit-pipeline.sh autopilot_pause epic=E193 step=qa score=0.51
#
# The emitted event (example):
#   {"ts":"...","event":"commit","epic":"E193","sha":"abc1234"}
#
# This helper ALWAYS terminates successfully (|| true idiom) — it must never
# block a pipeline step. The callers are responsible for appending `|| true`
# when invoking this script so that even a missing `jq` or unwritable log
# cannot propagate a non-zero exit into the pipeline.

set -euo pipefail

EVENT="${1:-}"

if [ -z "$EVENT" ]; then
  echo "Usage: audit-emit-pipeline.sh <event> [key=value ...]" >&2
  exit 1
fi

# Shift past the event argument; remaining args are key=value pairs.
shift

# Resolve repo root (best-effort; fall back to cwd)
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" 2>/dev/null || true

AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true

# Timestamp (overridable for tests)
TS="${CLOCK_TS:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

# Require jq — it's a hard dep for the audit log infrastructure
if ! command -v jq >/dev/null 2>&1; then
  echo "audit-emit-pipeline.sh: jq not found — cannot emit audit event" >&2
  exit 1
fi

# Build a jq --args array from key=value pairs.
# Each pair is split on the first '=' and injected via jq --arg so values are
# always treated as strings (no injection risk, no type guessing).
JQ_ARGS=()
JQ_REDUCE_PARTS=""

for PAIR in "$@"; do
  KEY="${PAIR%%=*}"
  VAL="${PAIR#*=}"
  # Skip empty keys
  [ -z "$KEY" ] && continue
  JQ_ARGS+=(--arg "${KEY}" "${VAL}")
  # Build a reduce expression: `. + {key: $key}`
  JQ_REDUCE_PARTS="${JQ_REDUCE_PARTS} | . + {\"${KEY}\": \$${KEY}}"
done

# Emit the JSONL line: start with base fields, then merge extra key=value pairs.
jq -n -c \
  --arg ts "$TS" \
  --arg event "$EVENT" \
  "${JQ_ARGS[@]}" \
  "{ts:\$ts,event:\$event}${JQ_REDUCE_PARTS}" \
  >> "$AUDIT_LOG" || true

echo "pipeline event emitted: event=$EVENT ts=$TS" >&2
