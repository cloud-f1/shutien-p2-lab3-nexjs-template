#!/usr/bin/env bash
# scripts/effort/resolve.sh — Effort Tier Resolver (E198)
#
# Resolves an effort tier from three sources (highest wins):
#   1. --effort <tier> flag anywhere in $* arguments
#   2. $ATHENA_EFFORT env var
#   3. Default: "standard"
#
# Outputs 6 eval-able export lines:
#   export MAX_CONCURRENT=<N>
#   export MAX_ITERATIONS=<N>
#   export REVIEW_LOOP_BUDGET=<N>
#   export AUTOPILOT_THRESHOLD=<N>
#   export ATHENA_VERIFY_POSTURE="<string>"
#   export ATHENA_MODEL_MAP="reviewer=<model>,evaluator=<model>,execute=<model>"
#       execute = the model for the per-epic spec→implement→qa→commit agent in
#       /athena:flow. It is the BASELINE for a "simple" epic; flow escalates a
#       "complex" epic (size L/XL) to opus regardless of tier. This is what stops
#       every epic running on opus — see .claude/commands/athena/flow.md Step 5.
#
# Also emits an effort_resolved audit event to .claude/audit.jsonl.
#
# Usage:
#   eval "$(scripts/effort/resolve.sh "$@" 2>/dev/null || true)"
#   eval "$(scripts/effort/resolve.sh --effort quick 2>/dev/null || true)"
#
# Env vars:
#   ATHENA_EFFORT    Fallback tier (quick|standard|thorough|ultra)
#   AUDIT_LOG_PATH   Override .claude/audit.jsonl path (for tests)
#   CLOCK_TS         Override timestamp (ISO 8601, for tests)
#
# Tier — knob table:
#   quick:    MAX_CONCURRENT=1, MAX_ITERATIONS=1, REVIEW_LOOP_BUDGET=15000,
#             AUTOPILOT_THRESHOLD=0.80, ATHENA_VERIFY_POSTURE=single-vote,
#             reviewer=haiku, evaluator=sonnet, execute=sonnet
#   standard: MAX_CONCURRENT=4, MAX_ITERATIONS=4, REVIEW_LOOP_BUDGET=50000,
#             AUTOPILOT_THRESHOLD=0.85, ATHENA_VERIFY_POSTURE=single-vote,
#             reviewer=sonnet, evaluator=sonnet, execute=sonnet
#   thorough: MAX_CONCURRENT=4, MAX_ITERATIONS=6, REVIEW_LOOP_BUDGET=150000,
#             AUTOPILOT_THRESHOLD=0.90, ATHENA_VERIFY_POSTURE=adversarial-3+perspective,
#             reviewer=sonnet, evaluator=opus, execute=sonnet
#   ultra:    MAX_CONCURRENT=min(16,cores-2), MAX_ITERATIONS=8, REVIEW_LOOP_BUDGET=500000,
#             AUTOPILOT_THRESHOLD=0.95, ATHENA_VERIFY_POSTURE=judge-panel+adversarial+multimodal,
#             reviewer=opus, evaluator=opus, execute=opus
#
# CRITICAL: standard tier values are IDENTICAL to today's hardcoded numbers.
# Omitting --effort changes no current behavior.

set -uo pipefail

# ---------------------------------------------------------------------------
# Precedence: parse --effort flag from arguments
# ---------------------------------------------------------------------------
TIER=""
SOURCE=""

# Walk arguments looking for --effort <value>
PREV_WAS_EFFORT=0
for arg in "$@"; do
  if [ "$PREV_WAS_EFFORT" -eq 1 ]; then
    TIER="$arg"
    SOURCE="flag"
    PREV_WAS_EFFORT=0
    break
  fi
  if [ "$arg" = "--effort" ]; then
    PREV_WAS_EFFORT=1
  fi
done

# Fall back to $ATHENA_EFFORT env var
if [ -z "$TIER" ] && [ -n "${ATHENA_EFFORT:-}" ]; then
  TIER="$ATHENA_EFFORT"
  SOURCE="env"
fi

# Fall back to standard
if [ -z "$TIER" ]; then
  TIER="standard"
  SOURCE="default"
fi

# Normalize to lowercase
TIER=$(echo "$TIER" | tr '[:upper:]' '[:lower:]')

# ---------------------------------------------------------------------------
# Knob table
# ---------------------------------------------------------------------------
case "$TIER" in
  quick)
    MAX_CONCURRENT=1
    MAX_ITERATIONS=1
    REVIEW_LOOP_BUDGET=15000
    AUTOPILOT_THRESHOLD=0.80
    ATHENA_VERIFY_POSTURE="single-vote"
    ATHENA_MODEL_MAP="reviewer=haiku,evaluator=sonnet,execute=sonnet"
    ;;
  standard)
    # MUST match today's hardcoded values byte-for-byte
    MAX_CONCURRENT=4
    MAX_ITERATIONS=4
    REVIEW_LOOP_BUDGET=50000
    AUTOPILOT_THRESHOLD=0.85
    ATHENA_VERIFY_POSTURE="single-vote"
    ATHENA_MODEL_MAP="reviewer=sonnet,evaluator=sonnet,execute=sonnet"
    ;;
  thorough)
    MAX_CONCURRENT=4
    MAX_ITERATIONS=6
    REVIEW_LOOP_BUDGET=150000
    AUTOPILOT_THRESHOLD=0.90
    ATHENA_VERIFY_POSTURE="adversarial-3+perspective"
    ATHENA_MODEL_MAP="reviewer=sonnet,evaluator=opus,execute=sonnet"
    ;;
  ultra)
    # Cores-aware cap: min(16, cores-2), floored at 1
    CORES=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo "4")
    CORES_MINUS_2=$(( CORES - 2 ))
    [ "$CORES_MINUS_2" -lt 1 ] && CORES_MINUS_2=1
    [ "$CORES_MINUS_2" -gt 16 ] && CORES_MINUS_2=16
    MAX_CONCURRENT=$CORES_MINUS_2
    MAX_ITERATIONS=8
    REVIEW_LOOP_BUDGET=500000
    AUTOPILOT_THRESHOLD=0.95
    ATHENA_VERIFY_POSTURE="judge-panel+adversarial+multimodal"
    ATHENA_MODEL_MAP="reviewer=opus,evaluator=opus,execute=opus"
    ;;
  *)
    # Unknown tier — fall back to standard (non-fatal)
    MAX_CONCURRENT=4
    MAX_ITERATIONS=4
    REVIEW_LOOP_BUDGET=50000
    AUTOPILOT_THRESHOLD=0.85
    ATHENA_VERIFY_POSTURE="single-vote"
    ATHENA_MODEL_MAP="reviewer=sonnet,evaluator=sonnet,execute=sonnet"
    TIER="standard"
    SOURCE="default"
    ;;
esac

# ---------------------------------------------------------------------------
# Emit eval-able export lines (stdout — consumed by eval)
# ---------------------------------------------------------------------------
echo "export MAX_CONCURRENT=${MAX_CONCURRENT}"
echo "export MAX_ITERATIONS=${MAX_ITERATIONS}"
echo "export REVIEW_LOOP_BUDGET=${REVIEW_LOOP_BUDGET}"
echo "export AUTOPILOT_THRESHOLD=${AUTOPILOT_THRESHOLD}"
echo "export ATHENA_VERIFY_POSTURE=\"${ATHENA_VERIFY_POSTURE}\""
echo "export ATHENA_MODEL_MAP=\"${ATHENA_MODEL_MAP}\""

# ---------------------------------------------------------------------------
# Emit effort_resolved audit event (best-effort, never blocks)
# ---------------------------------------------------------------------------
AUDIT_LOG="${AUDIT_LOG_PATH:-}"
if [ -z "$AUDIT_LOG" ]; then
  # Resolve repo root (best-effort)
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
  AUDIT_LOG="${REPO_ROOT}/.claude/audit.jsonl"
fi

TS="${CLOCK_TS:-$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")}"

mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true

if command -v jq >/dev/null 2>&1; then
  jq -n -c \
    --arg ts "$TS" \
    --arg tier "$TIER" \
    --arg source "$SOURCE" \
    --arg model_map "$ATHENA_MODEL_MAP" \
    --argjson max_concurrent "$MAX_CONCURRENT" \
    --arg verify_posture "$ATHENA_VERIFY_POSTURE" \
    '{"ts":$ts,"event":"effort_resolved","tier":$tier,"source":$source,"model_map":$model_map,"max_concurrent":$max_concurrent,"verify_posture":$verify_posture}' \
    >> "$AUDIT_LOG" 2>/dev/null || true
else
  # jq not available — write manually (safe values, no special chars)
  printf '{"ts":"%s","event":"effort_resolved","tier":"%s","source":"%s","model_map":"%s","max_concurrent":%s,"verify_posture":"%s"}\n' \
    "$TS" "$TIER" "$SOURCE" "$ATHENA_MODEL_MAP" "$MAX_CONCURRENT" "$ATHENA_VERIFY_POSTURE" >> "$AUDIT_LOG" 2>/dev/null || true
fi

# Always exit 0 — callers use || true but a non-zero exit would suppress exports
exit 0
