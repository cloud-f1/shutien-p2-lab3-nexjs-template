#!/usr/bin/env bash
# scripts/reviewer-loop.sh — Iterative Reviewer Convergence Loop (E162)
#
# Orchestrates @reviewer ↔ @debugger rounds inside one /athena:qa --review-only
# invocation. The script itself does NOT spawn Claude agents (bash can't);
# instead it inspects docs/context/review-findings.md, computes per-round
# convergence verdicts, and emits an audit event when the loop ends.
#
# Convergence criteria (any one stops the loop):
#   • 0 open findings (`- [ ]`) in current round  → CONVERGED (exit 0)
#   • Round-N hash identical to round-(N-1) hash  → STUCK     (exit 2)
#   • Round counter reaches MAX_ITERATIONS         → MAX       (exit 0)
#
# Env vars:
#   MAX_ITERATIONS      hard ceiling on rounds (default 4)
#   REVIEW_LOOP_BUDGET  token budget across rounds (default 50000) — informational
#   FINDINGS_FILE       review-findings.md path (default docs/context/review-findings.md)
#   AUDIT_FILE          audit log path (default .claude/audit.jsonl)
#
# Modes:
#   reviewer-loop.sh                 # walk all rounds 0..N in FINDINGS_FILE,
#                                    # print verdict, emit audit, exit accordingly
#   reviewer-loop.sh --check-round N # print verdict for a single round only
#                                    # (no audit emission, no looping)
#   reviewer-loop.sh --help          # usage
#
# Exit codes:
#   0 — CONVERGED or MAX_ITERATIONS reached cleanly
#   1 — usage / invocation error
#   2 — STUCK (identical findings hash to previous round; human required)

set -uo pipefail

MAX_ITERATIONS="${MAX_ITERATIONS:-4}"
BUDGET="${REVIEW_LOOP_BUDGET:-50000}"
FINDINGS_FILE="${FINDINGS_FILE:-docs/context/review-findings.md}"
AUDIT_FILE="${AUDIT_FILE:-.claude/audit.jsonl}"

usage() {
  sed -n '2,30p' "$0"
  exit 1
}

# Extract the body of `## Round N` (everything until the next `## Round` or EOF).
# Bash 3.2 / awk-portable; tolerates "## Round 0 — 2026-04-24" headings.
round_body() {
  local n="$1" file="$2"
  awk -v n="$n" '
    BEGIN { inblock = 0 }
    /^## Round / {
      if (inblock) exit
      header = $0
      sub(/^## Round +/, "", header)
      # match either "N" or "N <space> ..." or "N(stuff)"
      split(header, parts, /[^0-9]/)
      if (parts[1] == n) { inblock = 1; next }
    }
    inblock { print }
  ' "$file"
}

# Count open checkbox items `- [ ]` in a body (closed `- [x]` excluded).
count_open() {
  awk 'BEGIN{c=0} /^- \[ \]/{c++} END{print c+0}'
}

# Stable sha256 of a body (sorted lines so reordering doesn't trip us).
body_hash() {
  if command -v sha256sum >/dev/null 2>&1; then
    sort | sha256sum | awk '{print $1}'
  else
    # macOS fallback
    sort | shasum -a 256 | awk '{print $1}'
  fi
}

# Discover the highest round number present in the findings file.
highest_round() {
  local file="$1"
  awk '
    /^## Round / {
      h = $0
      sub(/^## Round +/, "", h)
      split(h, parts, /[^0-9]/)
      n = parts[1] + 0
      if (n > max) max = n
    }
    END { print max + 0 }
  ' "$file"
}

# Check a single round: prints "verdict|issue_count|hash"
check_round() {
  local n="$1" file="$2"
  local body
  body=$(round_body "$n" "$file")
  local issues hash
  issues=$(printf '%s\n' "$body" | count_open)
  hash=$(printf '%s\n' "$body" | body_hash)
  echo "${issues}|${hash}"
}

emit_audit() {
  local rounds="$1" final_issues="$2" verdict="$3"
  # Parse epic from current branch name (e.g. MH/feat/E193-slug → E193)
  local epic
  epic=$(git branch --show-current 2>/dev/null | sed -nE 's|.*[Ee]([0-9]+)-.*|E\1|p' | tr '[:lower:]' '[:upper:]')
  [ -z "$epic" ] && epic="none"
  # Use the canonical pipeline emit helper if available; fall back to raw printf.
  local emit_sh
  emit_sh="$(git rev-parse --show-toplevel 2>/dev/null)/scripts/hooks/audit-emit-pipeline.sh"
  if [ -x "$emit_sh" ]; then
    AUDIT_LOG_PATH="$AUDIT_FILE" \
      "$emit_sh" review_loop \
        epic="$epic" \
        rounds="$rounds" \
        final_issues="$final_issues" \
        verdict="$verdict" \
        budget="$BUDGET" \
        max_iterations="$MAX_ITERATIONS" \
      || true
  else
    local ts
    ts=$(date -u +%FT%TZ)
    mkdir -p "$(dirname "$AUDIT_FILE")"
    printf '{"ts":"%s","event":"review_loop","epic":"%s","rounds":%d,"final_issues":%d,"verdict":"%s","budget":%d,"max_iterations":%d}\n' \
      "$ts" "$epic" "$rounds" "$final_issues" "$verdict" "$BUDGET" "$MAX_ITERATIONS" \
      >> "$AUDIT_FILE"
  fi
}

# --------------------------------------------------------------------------- #
# Entry points
# --------------------------------------------------------------------------- #

case "${1:-}" in
  -h|--help) usage ;;
  --check-round)
    [[ $# -ge 2 ]] || usage
    n="$2"
    [[ -f "$FINDINGS_FILE" ]] || { echo "missing $FINDINGS_FILE" >&2; exit 1; }
    result=$(check_round "$n" "$FINDINGS_FILE")
    issues="${result%%|*}"
    hash="${result##*|}"
    if (( issues == 0 )); then
      echo "CONVERGED round=$n issues=0 hash=$hash"
      exit 0
    fi
    echo "OPEN round=$n issues=$issues hash=$hash"
    exit 0
    ;;
esac

[[ -f "$FINDINGS_FILE" ]] || { echo "missing $FINDINGS_FILE" >&2; exit 1; }

# Walk rounds 0..MAX_ITERATIONS, applying convergence rules.
prev_hash=""
verdict="MAX"
final_issues=0
last_round=0
top=$(highest_round "$FINDINGS_FILE")

round=0
while (( round <= top && round < MAX_ITERATIONS )); do
  result=$(check_round "$round" "$FINDINGS_FILE")
  issues="${result%%|*}"
  hash="${result##*|}"
  last_round=$round
  final_issues=$issues

  echo "Round $round — issues=$issues hash=${hash:0:12}"

  if (( issues == 0 )); then
    verdict="CONVERGED"
    echo "CONVERGED at round $round"
    break
  fi

  if [[ -n "$prev_hash" && "$hash" == "$prev_hash" ]]; then
    verdict="STUCK"
    echo "STUCK — round $round findings identical to round $((round-1)). Human required."
    emit_audit "$((round + 1))" "$final_issues" "$verdict"
    exit 2
  fi

  prev_hash="$hash"
  round=$((round + 1))
done

# If we exited the loop without converging and round counter hit ceiling,
# verdict is MAX. If we never entered the loop (no rounds in file), CONVERGED.
if [[ "$verdict" == "MAX" && $top -lt 0 ]]; then
  verdict="CONVERGED"
fi
if (( round >= MAX_ITERATIONS && final_issues > 0 )); then
  verdict="MAX_REACHED"
  echo "MAX_ITERATIONS=$MAX_ITERATIONS reached with $final_issues open issue(s)."
  # Emit coverage_dropped so audit log captures the cap hit (E199)
  bash "$(git rev-parse --show-toplevel 2>/dev/null)/scripts/hooks/audit-emit-coverage-drop.sh" \
    reviewer_loop MAX_ITERATIONS_reached review || true
fi

emit_audit "$((last_round + 1))" "$final_issues" "$verdict"
exit 0
