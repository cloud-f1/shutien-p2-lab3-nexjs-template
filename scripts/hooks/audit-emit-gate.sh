#!/bin/bash
# audit-emit-gate.sh — emit a `gate_result` event to .claude/audit.jsonl (E345)
#
# This is the structured record E345 exists to create: a gate's outcome is
# always one of pass / fail / skipped, and a `skipped` outcome MUST carry a
# reason. Skipping a gate is a legitimate engineering decision (shared DB
# container owned by another project, no seeded environment, etc.) — the
# Phase 82 incident this epic answers was never "gates got skipped," it was
# "the skip left no structured trace," so state and gate results all read
# PASS while an e2e-only defect sat on main. A reason-less skip would recreate
# that exact gap in a new, structured-looking form, so it is refused outright.
#
# Usage:
#   audit-emit-gate.sh <gate> <status> [--reason "..."] [--epic E123] [--phase N] [--wave M]
#
# Arguments:
#   gate     string   Gate name (e.g. typecheck, lint, unit, int, e2e — any
#                      string is accepted, matching audit-emit-pipeline.sh's
#                      permissive event-name convention)
#   status   enum     pass | fail | skipped
#   --reason "..."    REQUIRED when status=skipped (missing => exit 1, nothing
#                      emitted). Optional and ignored for pass/fail.
#   --epic E123       optional — which epic this gate result belongs to
#   --phase N         optional — which phase (scripts/gate-ledger.sh groups by
#                      this field; without it an event lands in the "unknown"
#                      bucket and is invisible to `--phase N` scoping)
#   --wave M          optional — which wave within the phase
#
# Environment overrides (for tests):
#   AUDIT_LOG_PATH   Override .claude/audit.jsonl path
#   CLOCK_TS         Override timestamp (ISO 8601, for fixture tests)
#
# Examples:
#   audit-emit-gate.sh e2e skipped --reason "shared postgres container owned by another project" --epic E336 --phase 82
#   audit-emit-gate.sh typecheck pass --epic E344 --phase 83 --wave 1
#   audit-emit-gate.sh unit fail --epic E345 --phase 83
#
# The emitted event (example):
#   {"ts":"...","event":"gate_result","gate":"e2e","status":"skipped","reason":"...","epic":"E336","phase":"82"}
#
# Unlike audit-emit-pipeline.sh, this helper does NOT swallow its own usage
# errors — a caller that gets the invocation wrong (skipped with no reason,
# or an invalid status) should see that immediately, not have it vanish.
# Callers who want best-effort semantics for a legitimately-run pass/fail can
# still append `|| true` themselves, exactly like every other emit-* script.

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: audit-emit-gate.sh <gate> <status> [--reason "..."] [--epic E123] [--phase N] [--wave M]
  status: pass | fail | skipped   (skipped REQUIRES --reason)
EOF
}

GATE="${1:-}"
STATUS="${2:-}"

if [ -z "$GATE" ] || [ -z "$STATUS" ]; then
  usage
  exit 1
fi

case "$STATUS" in
  pass|fail|skipped) ;;
  *)
    echo "audit-emit-gate.sh: invalid status '$STATUS' (expected pass|fail|skipped)" >&2
    exit 1
    ;;
esac

shift 2 2>/dev/null || shift $#

REASON=""
EPIC=""
PHASE=""
WAVE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --reason) REASON="${2:-}"; shift 2 2>/dev/null || shift $# ;;
    --epic)   EPIC="${2:-}";   shift 2 2>/dev/null || shift $# ;;
    --phase)  PHASE="${2:-}";  shift 2 2>/dev/null || shift $# ;;
    --wave)   WAVE="${2:-}";   shift 2 2>/dev/null || shift $# ;;
    *)
      echo "audit-emit-gate.sh: unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ "$STATUS" = "skipped" ] && [ -z "$REASON" ]; then
  echo "audit-emit-gate.sh: status=skipped requires --reason \"...\" — refusing to emit an unaccountable skip (E345)." >&2
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
  echo "audit-emit-gate.sh: jq not found — cannot emit audit event" >&2
  exit 1
fi

JQ_ARGS=(--arg ts "$TS" --arg event "gate_result" --arg gate "$GATE" --arg status "$STATUS")
JQ_FILTER='{ts:$ts,event:$event,gate:$gate,status:$status}'

if [ -n "$REASON" ]; then
  JQ_ARGS+=(--arg reason "$REASON")
  JQ_FILTER="${JQ_FILTER} + {reason:\$reason}"
fi
if [ -n "$EPIC" ]; then
  JQ_ARGS+=(--arg epic "$EPIC")
  JQ_FILTER="${JQ_FILTER} + {epic:\$epic}"
fi
if [ -n "$PHASE" ]; then
  JQ_ARGS+=(--arg phase "$PHASE")
  JQ_FILTER="${JQ_FILTER} + {phase:\$phase}"
fi
if [ -n "$WAVE" ]; then
  JQ_ARGS+=(--arg wave "$WAVE")
  JQ_FILTER="${JQ_FILTER} + {wave:\$wave}"
fi

jq -n -c "${JQ_ARGS[@]}" "$JQ_FILTER" >> "$AUDIT_LOG"

echo "gate_result emitted: gate=$GATE status=$STATUS ts=$TS" >&2
