#!/usr/bin/env bash
# scripts/autopilot.sh — Autopilot harness for /athena:autopilot (E164).
#
# Walks ONE epic through the pipeline (spec → implement → qa → commit → merge
# → deploy). At each step it computes a confidence score via
# scripts/confidence/<step>.sh and decides:
#   • score >= AUTOPILOT_THRESHOLD       → emit autopilot_advance, return 0
#   • score <  AUTOPILOT_THRESHOLD       → emit autopilot_pause + write
#                                          docs/context/autopilot-pause-<epic>-<step>.md
#                                          and return 2
#   • merge / prod-deploy with safety env unset → ALWAYS pause
#
# This script is intentionally a thin decision engine. It does NOT execute the
# step itself — the slash command (/athena:autopilot) is responsible for
# spawning the appropriate subagent (spec/implement/qa) or running inline
# (commit/merge/deploy). The harness is what the slash command calls between
# steps to decide whether to advance.
#
# Usage:
#   scripts/autopilot.sh <epic> <step>
#       step ∈ spec | implement | qa | commit | merge | deploy
#   scripts/autopilot.sh --score <epic> <step>     # print score only, no side
#                                                    effects (used by tests)
#   scripts/autopilot.sh --status <epic>           # show resume hint
#   scripts/autopilot.sh --help
#
# Env (defaults safe / conservative):
#   AUTOPILOT_THRESHOLD              0.85
#   AUTOPILOT_ALLOW_MERGE            unset → pause at merge
#   AUTOPILOT_ALLOW_PROD_DEPLOY      unset → pause at prod deploy
#   AUTOPILOT_DEPLOY_ENV             "staging" (only relevant for deploy)
#   AUDIT_FILE                       .claude/audit.jsonl
#   AUTOPILOT_LOG                    docs/context/autopilot-log.md
#
# Exit codes:
#   0  advance     (auto-advance OK; caller should run the next step)
#   2  pause       (artifact written; caller stops and reports)
#   1  usage error

set -uo pipefail

THRESHOLD="${AUTOPILOT_THRESHOLD:-0.85}"
AUDIT_FILE="${AUDIT_FILE:-.claude/audit.jsonl}"
LOG_FILE="${AUTOPILOT_LOG:-docs/context/autopilot-log.md}"
DEPLOY_ENV="${AUTOPILOT_DEPLOY_ENV:-staging}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

VALID_STEPS="spec implement qa commit merge deploy"

usage() {
  sed -n '2,33p' "$0"
  exit 1
}

is_valid_step() {
  local s="$1"
  for v in $VALID_STEPS; do
    [[ "$v" == "$s" ]] && return 0
  done
  return 1
}

compute_score() {
  local epic="$1" step="$2"
  case "$step" in
    spec|implement|qa|commit)
      local scorer="$SCRIPT_DIR/confidence/${step}.sh"
      if [[ -x "$scorer" ]]; then
        "$scorer" "$epic" 2>/dev/null
      else
        echo "0.0"
      fi
      ;;
    merge|deploy)
      # Merge & deploy don't have signal scorers — they're policy-gated.
      # Return 1.0 so the policy gate (below) is the only decision factor.
      echo "1.00"
      ;;
    *)
      echo "0.0"
      ;;
  esac
}

# Returns 0 if score >= threshold (using awk for float compare)
score_passes() {
  local score="$1" thr="$2"
  awk -v s="$score" -v t="$thr" 'BEGIN { exit !(s + 0 >= t + 0) }'
}

emit_audit() {
  local event="$1" epic="$2" step="$3" score="$4" reason="$5"
  # Use the canonical pipeline emit helper if available; fall back to raw printf.
  local emit_sh="${SCRIPT_DIR}/hooks/audit-emit-pipeline.sh"
  if [ -x "$emit_sh" ]; then
    AUDIT_LOG_PATH="$AUDIT_FILE" \
      "$emit_sh" "$event" \
        epic="$epic" \
        step="$step" \
        score="$score" \
        threshold="$THRESHOLD" \
        reason="$reason" \
      || true
  else
    local ts
    ts=$(date -u +%FT%TZ)
    mkdir -p "$(dirname "$AUDIT_FILE")"
    printf '{"ts":"%s","event":"%s","epic":"%s","step":"%s","score":%s,"threshold":%s,"reason":"%s"}\n' \
      "$ts" "$event" "$epic" "$step" "$score" "$THRESHOLD" "$reason" \
      >> "$AUDIT_FILE"
  fi
}

append_log() {
  local epic="$1" step="$2" score="$3" decision="$4" reason="$5"
  local ts
  ts=$(date -u +%FT%TZ)
  mkdir -p "$(dirname "$LOG_FILE")"
  if [[ ! -f "$LOG_FILE" ]]; then
    cat > "$LOG_FILE" <<'EOF'
# Autopilot Log

Audit trail of all autopilot decisions. Append-only. Each row records one
step decision (advance or pause) with the confidence score and reason.

| Timestamp | Epic | Step | Score | Threshold | Decision | Reason |
|-----------|------|------|-------|-----------|----------|--------|
EOF
  fi
  printf '| %s | %s | %s | %s | %s | %s | %s |\n' \
    "$ts" "$epic" "$step" "$score" "$THRESHOLD" "$decision" "$reason" \
    >> "$LOG_FILE"
}

write_pause_artifact() {
  local epic="$1" step="$2" score="$3" reason="$4"
  local f="docs/context/autopilot-pause-${epic}-${step}.md"
  mkdir -p "$(dirname "$f")"
  cat > "$f" <<EOF
# Autopilot Pause — ${epic} / ${step}

- **Confidence:** ${score} (threshold: ${THRESHOLD})
- **Reason:** ${reason}
- **Generated:** $(date -u +%FT%TZ)

## What to decide

Review the signal that triggered the pause (see Signals below) and decide
whether to:

1. Address the underlying issue (rerun the step), or
2. Override the gate by lowering AUTOPILOT_THRESHOLD for this run, or
3. Manually advance the step using the standard /athena commands.

For \`merge\` and \`deploy (prod)\` pauses, the gate is policy-driven, not
signal-driven — set the appropriate env var (\`AUTOPILOT_ALLOW_MERGE=1\` or
\`AUTOPILOT_ALLOW_PROD_DEPLOY=1\`) and rerun.

## Resume

\`\`\`
/athena:autopilot ${epic} --resume
\`\`\`

## Signals (raw)

- step: ${step}
- score: ${score}
- threshold: ${THRESHOLD}
- AUTOPILOT_ALLOW_MERGE: ${AUTOPILOT_ALLOW_MERGE:-unset}
- AUTOPILOT_ALLOW_PROD_DEPLOY: ${AUTOPILOT_ALLOW_PROD_DEPLOY:-unset}
- AUTOPILOT_DEPLOY_ENV: ${DEPLOY_ENV}
EOF
  echo "$f"
}

decide() {
  local epic="$1" step="$2"
  local score reason decision

  score=$(compute_score "$epic" "$step")

  # Policy gates (highest precedence) — these always pause regardless of score.
  if [[ "$step" == "merge" && "${AUTOPILOT_ALLOW_MERGE:-}" != "1" ]]; then
    reason="merge requires AUTOPILOT_ALLOW_MERGE=1 (policy gate)"
    emit_audit "autopilot_pause" "$epic" "$step" "$score" "$reason"
    append_log "$epic" "$step" "$score" "pause" "$reason"
    artifact=$(write_pause_artifact "$epic" "$step" "$score" "$reason")
    echo "PAUSE epic=$epic step=$step score=$score reason='$reason' artifact=$artifact"
    return 2
  fi

  if [[ "$step" == "deploy" && "$DEPLOY_ENV" == "prod" && "${AUTOPILOT_ALLOW_PROD_DEPLOY:-}" != "1" ]]; then
    reason="prod deploy requires AUTOPILOT_ALLOW_PROD_DEPLOY=1 (policy gate)"
    emit_audit "autopilot_pause" "$epic" "$step" "$score" "$reason"
    append_log "$epic" "$step" "$score" "pause" "$reason"
    artifact=$(write_pause_artifact "$epic" "$step" "$score" "$reason")
    echo "PAUSE epic=$epic step=$step score=$score reason='$reason' artifact=$artifact"
    return 2
  fi

  if score_passes "$score" "$THRESHOLD"; then
    reason="confidence ${score} >= threshold ${THRESHOLD}"
    emit_audit "autopilot_advance" "$epic" "$step" "$score" "$reason"
    append_log "$epic" "$step" "$score" "advance" "$reason"
    echo "ADVANCE epic=$epic step=$step score=$score"
    return 0
  fi

  reason="confidence ${score} < threshold ${THRESHOLD}"
  emit_audit "autopilot_pause" "$epic" "$step" "$score" "$reason"
  append_log "$epic" "$step" "$score" "pause" "$reason"
  artifact=$(write_pause_artifact "$epic" "$step" "$score" "$reason")
  echo "PAUSE epic=$epic step=$step score=$score reason='$reason' artifact=$artifact"
  return 2
}

# --------------------------------------------------------------------------- #
# Entry points
# --------------------------------------------------------------------------- #

case "${1:-}" in
  -h|--help)
    usage
    ;;
  --score)
    [[ $# -ge 3 ]] || usage
    is_valid_step "$3" || { echo "invalid step: $3" >&2; exit 1; }
    compute_score "$2" "$3"
    exit 0
    ;;
  --status)
    [[ $# -ge 2 ]] || usage
    epic="$2"
    pauses=$(ls docs/context/autopilot-pause-"$epic"-*.md 2>/dev/null || true)
    if [[ -z "$pauses" ]]; then
      echo "No pause artifacts for $epic. Last advance (if any) recorded in $LOG_FILE."
    else
      echo "Pause artifacts for $epic:"
      echo "$pauses"
      echo "Resume with: /athena:autopilot $epic --resume"
    fi
    exit 0
    ;;
  "")
    usage
    ;;
esac

[[ $# -ge 2 ]] || usage
EPIC="$1"
STEP="$2"
is_valid_step "$STEP" || { echo "invalid step: $STEP (valid: $VALID_STEPS)" >&2; exit 1; }

decide "$EPIC" "$STEP"
