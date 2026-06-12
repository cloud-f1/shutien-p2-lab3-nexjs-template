#!/usr/bin/env bash
# scripts/qa/verify-panel.sh — Workflow-native QA Verification Panel (E200)
#
# Headless-Claude 4-lens review panel for the "thorough" effort tier.
# Replaces the markdown-IPC reviewer-loop.sh path at thorough posture with
# structured-output IPC via: claude -p --output-format json --json-schema
#
# Usage:
#   verify-panel.sh <epic_id> [--diff HEAD | <diff_context_path>]
#
# Arguments:
#   $1  epic_id          Epic identifier, e.g. E200
#   $2  diff_context     "--diff HEAD" (default) or path to a file with diff/context
#
# Environment:
#   ATHENA_VERIFY_POSTURE  Must be "thorough" or "ultra" to activate the panel.
#                          Any other value (standard, quick, unset) → exit 0 (standard path).
#   CLAUDE_CMD             Override the claude binary (default: "claude").
#                          Used by fixture tests to inject mock claude.
#   AUDIT_LOG_PATH         Override .claude/audit.jsonl path (for tests).
#   CLOCK_TS               Override timestamp (ISO 8601, for tests).
#   FINDINGS_SCHEMA        Override schema path (default: scripts/qa/findings-schema.json).
#   SCHEMA_MAX_RETRIES     Max retries on claude non-zero exit (default: 3).
#   REFUTE_N               Number of independent refutors per finding (default: 3).
#   REFUTE_MAJORITY        Min refutors needed to drop a finding (default: 2).
#
# Outputs:
#   stdout: human-readable panel report + final verdict
#   .claude/audit.jsonl: verify_panel_start + verify_panel_result events
#
# Exit codes:
#   0  — PASS or STUCK (STUCK requires human review — see stdout)
#   1  — FAIL (surviving open findings after refute pass)
#   2  — Hard failure (schema error after max retries, or invocation error)
#
# Standard/quick posture: exits 0 immediately with an informational message.
# reviewer-loop.sh remains the standard path — DO NOT modify it.

set -uo pipefail

# ---------------------------------------------------------------------------
# Config / defaults
# ---------------------------------------------------------------------------

EPIC_ID="${1:-unknown}"
DIFF_ARG="${2:---diff HEAD}"

POSTURE="${ATHENA_VERIFY_POSTURE:-}"
CLAUDE="${CLAUDE_CMD:-claude}"
SCHEMA_MAX_RETRIES="${SCHEMA_MAX_RETRIES:-3}"
REFUTE_N="${REFUTE_N:-3}"
REFUTE_MAJORITY="${REFUTE_MAJORITY:-2}"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
AUDIT_LOG="${AUDIT_LOG_PATH:-${REPO_ROOT}/.claude/audit.jsonl}"
SCHEMA="${FINDINGS_SCHEMA:-${REPO_ROOT}/scripts/qa/findings-schema.json}"
EMIT_SH="${REPO_ROOT}/scripts/hooks/audit-emit-pipeline.sh"

TS="${CLOCK_TS:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

# ---------------------------------------------------------------------------
# Posture guard — standard/quick/unset → standard path, exit 0
# ---------------------------------------------------------------------------

case "${POSTURE}" in
  thorough|judge-panel*)
    # Continue — panel is active
    ;;
  *)
    echo "[verify-panel] ATHENA_VERIFY_POSTURE='${POSTURE}' — standard path, skipping panel."
    echo "[verify-panel] reviewer-loop.sh handles this posture (unchanged)."
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log() { echo "[verify-panel] $*" >&2; }

die() {
  echo "[verify-panel] FATAL: $*" >&2
  exit 2
}

# Emit an audit event via the pipeline helper (best-effort, never blocks).
emit_audit() {
  local event="$1"; shift
  if [ -x "$EMIT_SH" ]; then
    AUDIT_LOG_PATH="$AUDIT_LOG" CLOCK_TS="$TS" \
      bash "$EMIT_SH" "$event" "$@" 2>/dev/null || true
  else
    # Fallback: direct jq write
    if command -v jq >/dev/null 2>&1; then
      local extra_args=()
      local reduce=""
      for pair in "$@"; do
        local k="${pair%%=*}"
        local v="${pair#*=}"
        [ -z "$k" ] && continue
        extra_args+=(--arg "$k" "$v")
        reduce+=" | . + {\"${k}\": \$${k}}"
      done
      jq -n -c \
        --arg ts "$TS" \
        --arg event "$event" \
        "${extra_args[@]}" \
        "{ts:\$ts,event:\$event}${reduce}" \
        >> "$AUDIT_LOG" 2>/dev/null || true
    fi
  fi
}

# Run claude with the findings schema. Retries up to SCHEMA_MAX_RETRIES times.
# Outputs the structured_output JSON object on stdout.
# Returns 0 on success, 2 on hard failure after retries.
run_claude_structured() {
  local prompt="$1"
  local model="${2:-claude-sonnet-4-6}"
  local attempt=0

  while [ "$attempt" -lt "$SCHEMA_MAX_RETRIES" ]; do
    attempt=$(( attempt + 1 ))
    local raw
    raw=$( "$CLAUDE" -p "$prompt" \
             --output-format json \
             --json-schema "$SCHEMA" \
             --model "$model" \
             2>/dev/null ) || {
      log "  claude exited non-zero (attempt $attempt/$SCHEMA_MAX_RETRIES)"
      if [ "$attempt" -ge "$SCHEMA_MAX_RETRIES" ]; then
        log "  schema error after $SCHEMA_MAX_RETRIES attempts — hard fail"
        return 2
      fi
      continue
    }

    # Extract structured_output
    local structured
    structured=$(echo "$raw" | jq -r '.structured_output // empty' 2>/dev/null)
    if [ -z "$structured" ]; then
      log "  no structured_output in claude response (attempt $attempt/$SCHEMA_MAX_RETRIES)"
      if [ "$attempt" -ge "$SCHEMA_MAX_RETRIES" ]; then
        return 2
      fi
      continue
    fi

    echo "$structured"
    return 0
  done
  return 2
}

# Run a simple yes/no refute call. Returns 0 if the finding is refuted.
run_refute() {
  local finding_json="$1"
  local finding_id
  finding_id=$(echo "$finding_json" | jq -r '.id' 2>/dev/null)
  local evidence
  evidence=$(echo "$finding_json" | jq -r '.evidence' 2>/dev/null)

  local refute_schema
  refute_schema='{"type":"object","required":["refuted","rationale"],"properties":{"refuted":{"type":"boolean"},"rationale":{"type":"string"}}}'

  local prompt="You are a skeptical code reviewer asked to REFUTE the following finding. Be adversarial. Try hard to disprove it. Only say refuted=true if the finding is genuinely wrong, a false positive, or based on a misread of the code.

Finding ID: ${finding_id}
Evidence: ${evidence}

Respond with: refuted=true/false and your rationale."

  local raw
  raw=$( "$CLAUDE" -p "$prompt" \
           --output-format json \
           --json-schema "$refute_schema" \
           --model "claude-sonnet-4-6" \
           2>/dev/null ) || return 1

  local refuted
  refuted=$(echo "$raw" | jq -r '.structured_output.refuted // "false"' 2>/dev/null)
  [ "$refuted" = "true" ] && return 0
  return 1
}

# ---------------------------------------------------------------------------
# Build diff/context text for prompts
# ---------------------------------------------------------------------------

DIFF_CONTEXT=""
if [ "$DIFF_ARG" = "--diff HEAD" ]; then
  DIFF_CONTEXT=$(git diff HEAD 2>/dev/null || git diff 2>/dev/null || echo "(no diff available)")
elif [ -f "$DIFF_ARG" ]; then
  DIFF_CONTEXT=$(cat "$DIFF_ARG")
else
  DIFF_CONTEXT="Epic: $EPIC_ID — diff context not available"
fi

# Truncate to avoid overwhelming claude (keep first 8000 chars)
DIFF_CONTEXT="${DIFF_CONTEXT:0:8000}"

# ---------------------------------------------------------------------------
# Phase 1: Emit verify_panel_start audit event
# ---------------------------------------------------------------------------

LENS_COUNT=4
log "Starting 4-lens verification panel for epic $EPIC_ID (posture=$POSTURE)"

emit_audit verify_panel_start \
  "epic=${EPIC_ID}" \
  "posture=${POSTURE}" \
  "lens_count=${LENS_COUNT}" || true

# ---------------------------------------------------------------------------
# Phase 2: 4-lens panel (correctness / security / perf / repro)
# ---------------------------------------------------------------------------

declare -a LENS_NAMES=("correctness" "security" "perf" "repro")
declare -a LENS_PROMPTS=(
  "You are a correctness reviewer. Analyze this code diff for logical errors, incorrect behavior, wrong return values, edge cases that are not handled, and mismatches between implementation and specification. Output a structured review with verdict (PASS/FAIL/STUCK) and findings array.

Epic: ${EPIC_ID}
Diff:
${DIFF_CONTEXT}"

  "You are a security reviewer. Analyze this code diff for security vulnerabilities including: SQL injection, authentication bypass, authorization failures, insecure data storage, missing input validation, hardcoded secrets, CORS issues, and any other security anti-patterns. Output a structured review with verdict (PASS/FAIL/STUCK) and findings array.

Epic: ${EPIC_ID}
Diff:
${DIFF_CONTEXT}"

  "You are a performance reviewer. Analyze this code diff for performance issues including: N+1 queries, missing indexes (based on query patterns), unbounded loops, memory leaks, synchronous blocking in async contexts, missing caching where beneficial, and algorithmic inefficiency. Output a structured review with verdict (PASS/FAIL/STUCK) and findings array.

Epic: ${EPIC_ID}
Diff:
${DIFF_CONTEXT}"

  "You are a reproducibility reviewer. Analyze this code diff for testability and reproducibility issues including: non-deterministic behavior, hardcoded timestamps or random seeds, environment-specific assumptions, missing error handling that would make failures hard to diagnose, and acceptance criteria that cannot be verified from the code alone. Output a structured review with verdict (PASS/FAIL/STUCK) and findings array.

Epic: ${EPIC_ID}
Diff:
${DIFF_CONTEXT}"
)

# Collect all findings across lenses
ALL_FINDINGS_JSON="[]"
LENS_VERDICTS=()
LENS_ERRORS=0

log "Running 4 lenses..."

for i in 0 1 2 3; do
  lens="${LENS_NAMES[$i]}"
  prompt="${LENS_PROMPTS[$i]}"
  log "  Lens [$((i+1))/4]: $lens"

  structured=$(run_claude_structured "$prompt" "claude-sonnet-4-6") || {
    log "  Lens $lens failed after retries — marking as schema-error finding"
    LENS_ERRORS=$(( LENS_ERRORS + 1 ))
    error_finding=$(jq -n -c \
      --arg id "schema-error-${lens}" \
      --arg lens "$lens" \
      '{"id":$id,"severity":"high","open":true,"evidence":"Schema error in lens: \($lens) — claude failed to return structured output after max retries"}')
    ALL_FINDINGS_JSON=$(echo "$ALL_FINDINGS_JSON" | jq -c ". + [$error_finding]")
    LENS_VERDICTS+=("FAIL")
    continue
  }

  # Validate and extract findings from this lens
  lens_findings=$(echo "$structured" | jq -c '.findings // []' 2>/dev/null)
  lens_verdict=$(echo "$structured" | jq -r '.verdict // "FAIL"' 2>/dev/null)

  if [ -z "$lens_findings" ] || [ "$lens_findings" = "null" ]; then
    lens_findings="[]"
    lens_verdict="PASS"
  fi

  # Prefix finding IDs with lens name to avoid collisions
  lens_findings=$(echo "$lens_findings" | jq -c --arg lens "$lens" \
    '[.[] | .id = ($lens + ":" + .id)]' 2>/dev/null || echo "[]")

  ALL_FINDINGS_JSON=$(echo "$ALL_FINDINGS_JSON" | jq -c ". + $lens_findings" 2>/dev/null || echo "$ALL_FINDINGS_JSON")
  LENS_VERDICTS+=("$lens_verdict")
  log "    verdict=$lens_verdict findings=$(echo "$lens_findings" | jq 'length' 2>/dev/null)"
done

# ---------------------------------------------------------------------------
# Phase 3: STUCK detection
# ---------------------------------------------------------------------------
# Compare current finding set to previous round (if a state file exists).
# A round is STUCK iff {id, open} pairs are identical to previous round.

STATE_FILE="${REPO_ROOT}/.claude/.verify-panel-state-${EPIC_ID}"
CURRENT_ID_OPEN_SET=$(echo "$ALL_FINDINGS_JSON" | \
  jq -c '[.[] | {id:.id, open:.open}] | sort_by(.id)' 2>/dev/null || echo "[]")

STUCK=false
if [ -f "$STATE_FILE" ]; then
  PREV_SET=$(cat "$STATE_FILE" 2>/dev/null || echo "[]")
  if [ "$CURRENT_ID_OPEN_SET" = "$PREV_SET" ]; then
    STUCK=true
    log "STUCK detected — finding set identical to previous round"
  fi
fi

# Save current state for next round comparison
echo "$CURRENT_ID_OPEN_SET" > "$STATE_FILE" 2>/dev/null || true

if [ "$STUCK" = "true" ]; then
  FINAL_VERDICT="STUCK"
  OPEN_COUNT=$(echo "$ALL_FINDINGS_JSON" | jq '[.[] | select(.open == true)] | length' 2>/dev/null || echo "0")
  emit_audit verify_panel_result \
    "epic=${EPIC_ID}" \
    "verdict=STUCK" \
    "refuted_count=0" \
    "lens_count=${LENS_COUNT}" \
    "open_count=${OPEN_COUNT}" || true
  echo ""
  echo "============================================================"
  echo "  verify-panel REPORT — Epic ${EPIC_ID} — Posture: ${POSTURE}"
  echo "============================================================"
  echo ""
  echo "FINAL VERDICT: STUCK"
  echo ""
  echo "Finding set is identical to the previous round — human review required."
  echo "Open findings count: ${OPEN_COUNT}"
  echo "Audit: verify_panel_start + verify_panel_result emitted to ${AUDIT_LOG}"
  echo "============================================================"
  exit 0
fi

# ---------------------------------------------------------------------------
# Phase 4: Adversarial refute — N=3 per open finding, majority-drop
# ---------------------------------------------------------------------------

OPEN_FINDINGS=$(echo "$ALL_FINDINGS_JSON" | jq -c '[.[] | select(.open == true)]' 2>/dev/null || echo "[]")
OPEN_COUNT=$(echo "$OPEN_FINDINGS" | jq 'length' 2>/dev/null || echo "0")
log "Adversarial refute: $OPEN_COUNT open findings to challenge (N=${REFUTE_N} refutors each)"

REFUTED_COUNT=0
SURVIVING_FINDINGS="$ALL_FINDINGS_JSON"

if [ "$OPEN_COUNT" -gt 0 ]; then
  # For each open finding, run REFUTE_N independent refute calls
  FINDINGS_TO_PROCESS=$(echo "$OPEN_FINDINGS" | jq -c '.[]' 2>/dev/null)

  while IFS= read -r finding_json; do
    [ -z "$finding_json" ] && continue
    finding_id=$(echo "$finding_json" | jq -r '.id' 2>/dev/null)
    log "  Refuting finding: $finding_id"

    refute_votes=0
    for r in $(seq 1 "$REFUTE_N"); do
      if run_refute "$finding_json"; then
        refute_votes=$(( refute_votes + 1 ))
        log "    Refutor $r/$REFUTE_N: REFUTED"
      else
        log "    Refutor $r/$REFUTE_N: confirmed"
      fi
    done

    if [ "$refute_votes" -ge "$REFUTE_MAJORITY" ]; then
      log "  -> Majority-refuted ($refute_votes/${REFUTE_N}) — dropping finding $finding_id"
      REFUTED_COUNT=$(( REFUTED_COUNT + 1 ))
      # Remove this finding from surviving set
      escaped_id=$(echo "$finding_id" | jq -Rr @json)
      SURVIVING_FINDINGS=$(echo "$SURVIVING_FINDINGS" | \
        jq -c --argjson fid "$escaped_id" '[.[] | select(.id != $fid)]' 2>/dev/null || echo "$SURVIVING_FINDINGS")
    else
      log "  -> Survives ($refute_votes/${REFUTE_N} refuted) — keeping finding $finding_id"
    fi
  done <<< "$FINDINGS_TO_PROCESS"
fi

log "Refute pass complete: $REFUTED_COUNT dropped, $((OPEN_COUNT - REFUTED_COUNT)) surviving"

# ---------------------------------------------------------------------------
# Phase 5: Completeness critic
# ---------------------------------------------------------------------------
# Ask claude which acceptance criteria have no file:line citation in evidence.

EPIC_ID_LOWER=$(echo "$EPIC_ID" | tr '[:upper:]' '[:lower:]')
EPIC_SPEC_FILE=$(find "${REPO_ROOT}/docs/epics" -name "e${EPIC_ID_LOWER}-*.md" -o -name "${EPIC_ID_LOWER}-*.md" 2>/dev/null | head -1)
if [ -z "$EPIC_SPEC_FILE" ]; then
  # Try with numeric part only (e.g. e200-*.md from E200)
  EPIC_NUM=$(echo "$EPIC_ID_LOWER" | tr -d 'e')
  EPIC_SPEC_FILE=$(find "${REPO_ROOT}/docs/epics" -name "e${EPIC_NUM}-*.md" 2>/dev/null | head -1)
fi

COMPLETENESS_FLAGGED="[]"
if [ -n "$EPIC_SPEC_FILE" ] && [ -f "$EPIC_SPEC_FILE" ]; then
  log "Completeness critic: checking spec at $EPIC_SPEC_FILE"
  SPEC_CONTENT=$(cat "$EPIC_SPEC_FILE" 2>/dev/null | head -200)
  EVIDENCE_SUMMARY=$(echo "$SURVIVING_FINDINGS" | jq -r '[.[] | .evidence] | join("\n---\n")' 2>/dev/null || echo "(no evidence)")

  CRITIC_PROMPT="You are a completeness critic. Given the epic spec acceptance criteria and the reviewer evidence, identify which acceptance criteria have NO cited file:line reference in the evidence.

Epic Spec (Acceptance Criteria section):
${SPEC_CONTENT}

Reviewer Evidence:
${EVIDENCE_SUMMARY}

Output a structured object with a findings array. For each acceptance criterion that has no file:line citation in the evidence, add a finding with severity=info, open=true, and evidence explaining which criterion is uncovered. Use id format: 'completeness:AC-N' where N is the criterion number."

  critic_result=$(run_claude_structured "$CRITIC_PROMPT" "claude-opus-4-8") || {
    log "  Completeness critic call failed — skipping"
    critic_result=""
  }

  if [ -n "$critic_result" ]; then
    critic_findings=$(echo "$critic_result" | jq -c '.findings // []' 2>/dev/null || echo "[]")
    critic_count=$(echo "$critic_findings" | jq 'length' 2>/dev/null || echo "0")
    log "  Completeness critic flagged $critic_count uncovered criteria"
    if [ "$critic_count" -gt 0 ]; then
      COMPLETENESS_FLAGGED="$critic_findings"
      SURVIVING_FINDINGS=$(echo "$SURVIVING_FINDINGS" | jq -c ". + $critic_findings" 2>/dev/null || echo "$SURVIVING_FINDINGS")
    fi
  fi
else
  log "Completeness critic: no spec file found for $EPIC_ID — skipping"
fi

# ---------------------------------------------------------------------------
# Phase 5.5 (Ultra only): Double-evaluator + N=3 judge panel (E206)
# ---------------------------------------------------------------------------
# Runs ONLY when POSTURE matches "judge-panel*" (ultra tier).
# The thorough panel above stays byte-identical — this section is purely additive.
#
# 1. Two independent evaluator calls (opus) — both must PASS for advance.
#    Agree-PASS → continue; Agree-FAIL → FAIL; Disagree → ESCALATE (needs_human).
# 2. N=3 judge panel (opus) — coverage / correctness / regression.
#    ≥2/3 judges mark AC open → blocking finding (FAIL).
#    1/3 judge marks AC open → advisory only (logged, non-blocking).

ULTRA_FINAL_VERDICT=""   # will override FINAL_VERDICT below if set
ULTRA_EVAL_A_VERDICT=""
ULTRA_EVAL_B_VERDICT=""
ULTRA_AGREED=""
ULTRA_JUDGE_OPEN_COUNT=0

if [[ "$POSTURE" == judge-panel* ]]; then
  ULTRA_MODEL="${ATHENA_ULTRA_MODEL:-claude-opus-4-8}"
  log "Ultra panel starting (posture=${POSTURE}, model=${ULTRA_MODEL})"

  # --- 5.5a: Evaluator A ---
  EVAL_A_PROMPT="You are an independent evaluator (independent evaluator context A). Evaluate whether this epic's implementation satisfies its acceptance criteria. Use ONLY the diff and spec provided — do NOT share context with any other evaluator.

Epic: ${EPIC_ID}
Spec file: ${EPIC_SPEC_FILE:-not found}

$([ -n "$EPIC_SPEC_FILE" ] && [ -f "$EPIC_SPEC_FILE" ] && head -200 "$EPIC_SPEC_FILE" 2>/dev/null || echo '(spec not found)')

Diff:
${DIFF_CONTEXT}

Output a structured review with verdict (PASS/FAIL) and findings array."

  log "  Ultra: running evaluator A (${ULTRA_MODEL})"
  eval_a_result=$(run_claude_structured "$EVAL_A_PROMPT" "$ULTRA_MODEL") || {
    log "  Ultra: evaluator A failed after retries — treating as FAIL"
    eval_a_result='{"verdict":"FAIL","findings":[{"id":"ultra:eval-a-error","severity":"high","open":true,"evidence":"Evaluator A failed to return structured output"}]}'
  }
  ULTRA_EVAL_A_VERDICT=$(echo "$eval_a_result" | jq -r '.verdict // "FAIL"' 2>/dev/null || echo "FAIL")
  log "  Ultra: evaluator A verdict = ${ULTRA_EVAL_A_VERDICT}"

  # --- 5.5b: Evaluator B ---
  EVAL_B_PROMPT="You are an independent evaluator (independent evaluator context B). Evaluate whether this epic's implementation satisfies its acceptance criteria. Use ONLY the diff and spec provided — do NOT share context with any other evaluator.

Epic: ${EPIC_ID}
Spec file: ${EPIC_SPEC_FILE:-not found}

$([ -n "$EPIC_SPEC_FILE" ] && [ -f "$EPIC_SPEC_FILE" ] && head -200 "$EPIC_SPEC_FILE" 2>/dev/null || echo '(spec not found)')

Diff:
${DIFF_CONTEXT}

Output a structured review with verdict (PASS/FAIL) and findings array."

  log "  Ultra: running evaluator B (${ULTRA_MODEL})"
  eval_b_result=$(run_claude_structured "$EVAL_B_PROMPT" "$ULTRA_MODEL") || {
    log "  Ultra: evaluator B failed after retries — treating as FAIL"
    eval_b_result='{"verdict":"FAIL","findings":[{"id":"ultra:eval-b-error","severity":"high","open":true,"evidence":"Evaluator B failed to return structured output"}]}'
  }
  ULTRA_EVAL_B_VERDICT=$(echo "$eval_b_result" | jq -r '.verdict // "FAIL"' 2>/dev/null || echo "FAIL")
  log "  Ultra: evaluator B verdict = ${ULTRA_EVAL_B_VERDICT}"

  # --- 5.5c: Agreement check ---
  if [ "$ULTRA_EVAL_A_VERDICT" = "$ULTRA_EVAL_B_VERDICT" ]; then
    ULTRA_AGREED="true"
    log "  Ultra: evaluators agree on ${ULTRA_EVAL_A_VERDICT}"
    if [ "$ULTRA_EVAL_A_VERDICT" = "PASS" ]; then
      # Agreement on PASS — proceed to judge panel
      : # ULTRA_FINAL_VERDICT stays unset until judge panel
    else
      # Agreement on FAIL — collect both evaluators' findings
      eval_a_findings=$(echo "$eval_a_result" | jq -c '.findings // []' 2>/dev/null || echo "[]")
      eval_b_findings=$(echo "$eval_b_result" | jq -c '.findings // []' 2>/dev/null || echo "[]")
      eval_a_findings=$(echo "$eval_a_findings" | jq -c '[.[] | .id = ("eval-a:" + .id)]' 2>/dev/null || echo "[]")
      eval_b_findings=$(echo "$eval_b_findings" | jq -c '[.[] | .id = ("eval-b:" + .id)]' 2>/dev/null || echo "[]")
      SURVIVING_FINDINGS=$(echo "$SURVIVING_FINDINGS" | jq -c ". + $eval_a_findings + $eval_b_findings" 2>/dev/null || echo "$SURVIVING_FINDINGS")
      ULTRA_FINAL_VERDICT="FAIL"
    fi
  else
    # Disagreement → ESCALATE
    ULTRA_AGREED="false"
    ULTRA_FINAL_VERDICT="ESCALATE"
    log "  Ultra: evaluators DISAGREE (A=${ULTRA_EVAL_A_VERDICT}, B=${ULTRA_EVAL_B_VERDICT}) — ESCALATE"
    # Add an escalation finding to surviving findings
    escalate_finding=$(jq -n -c \
      --arg va "$ULTRA_EVAL_A_VERDICT" \
      --arg vb "$ULTRA_EVAL_B_VERDICT" \
      '{"id":"ultra:evaluator-disagreement","severity":"high","open":true,"evidence":("Evaluator disagreement: A=" + $va + " B=" + $vb + " — needs_human review required before advance")}')
    SURVIVING_FINDINGS=$(echo "$SURVIVING_FINDINGS" | jq -c ". + [$escalate_finding]" 2>/dev/null || echo "$SURVIVING_FINDINGS")
  fi

  # --- 5.5d: N=3 judge panel (runs when evaluators agree on PASS or when FAIL agreed — still run for completeness) ---
  # Only skip judge panel on ESCALATE (no point in extra cost when human review is forced anyway)
  if [ "$ULTRA_FINAL_VERDICT" != "ESCALATE" ]; then
    log "  Ultra: running N=3 judge panel (${ULTRA_MODEL})"

    JUDGE_SPEC=""
    if [ -n "$EPIC_SPEC_FILE" ] && [ -f "$EPIC_SPEC_FILE" ]; then
      JUDGE_SPEC=$(head -200 "$EPIC_SPEC_FILE" 2>/dev/null)
    fi

    # Judge prompts keyed by detectable phrase
    JUDGE_A_PROMPT="You are Judge A (coverage) in an N=3 judge panel. Your question: 'Which acceptance criterion has no cited file:line in the evidence?'

Epic: ${EPIC_ID}
Epic Spec:
${JUDGE_SPEC:-'(spec not found)'}

Evidence (from reviewer findings):
$(echo "$SURVIVING_FINDINGS" | jq -r '[.[] | .evidence] | join("\n---\n")' 2>/dev/null || echo '(no evidence)')

For each acceptance criterion that has NO file:line citation in the evidence, add a finding with open=true. If all are cited, output an empty findings array with verdict=PASS."

    JUDGE_B_PROMPT="You are Judge B (correctness) in an N=3 judge panel. Your question: 'Does any cited evidence actually fail to satisfy the AC it claims?'

Epic: ${EPIC_ID}
Epic Spec:
${JUDGE_SPEC:-'(spec not found)'}

Evidence (from reviewer findings):
$(echo "$SURVIVING_FINDINGS" | jq -r '[.[] | .evidence] | join("\n---\n")' 2>/dev/null || echo '(no evidence)')

For each acceptance criterion where the cited evidence does NOT actually satisfy the criterion, add a finding with open=true. If all evidence satisfies its AC, output an empty findings array with verdict=PASS."

    JUDGE_C_PROMPT="You are Judge C (regression) in an N=3 judge panel. Your question: 'Does any change plausibly break an untested adjacent behavior?'

Epic: ${EPIC_ID}
Epic Spec:
${JUDGE_SPEC:-'(spec not found)'}

Diff:
${DIFF_CONTEXT}

For each change that plausibly breaks an adjacent behavior that is not covered by the evidence, add a finding with open=true. If no regression risk is found, output an empty findings array with verdict=PASS."

    # Run the 3 judges sequentially, storing results per-judge in indexed vars
    JUDGES_WITH_OPEN=0
    ALL_JUDGE_OPEN_FINDINGS="[]"
    JUDGE_OPEN_A="[]"
    JUDGE_OPEN_B="[]"
    JUDGE_OPEN_C="[]"

    log "    Judge 1/3: judge-a (coverage)"
    judge_a_result=$(run_claude_structured "$JUDGE_A_PROMPT" "$ULTRA_MODEL") || {
      log "    judge-a failed — treating as no open findings"
      judge_a_result='{"verdict":"PASS","findings":[]}'
    }
    JUDGE_OPEN_A=$(echo "$judge_a_result" | jq -c '[.findings // [] | .[] | select(.open == true) | .id = ("judge-a:" + .id)]' 2>/dev/null || echo "[]")
    judge_a_count=$(echo "$JUDGE_OPEN_A" | jq 'length' 2>/dev/null || echo "0")
    log "    judge-a: ${judge_a_count} open finding(s)"

    log "    Judge 2/3: judge-b (correctness)"
    judge_b_result=$(run_claude_structured "$JUDGE_B_PROMPT" "$ULTRA_MODEL") || {
      log "    judge-b failed — treating as no open findings"
      judge_b_result='{"verdict":"PASS","findings":[]}'
    }
    JUDGE_OPEN_B=$(echo "$judge_b_result" | jq -c '[.findings // [] | .[] | select(.open == true) | .id = ("judge-b:" + .id)]' 2>/dev/null || echo "[]")
    judge_b_count=$(echo "$JUDGE_OPEN_B" | jq 'length' 2>/dev/null || echo "0")
    log "    judge-b: ${judge_b_count} open finding(s)"

    log "    Judge 3/3: judge-c (regression)"
    judge_c_result=$(run_claude_structured "$JUDGE_C_PROMPT" "$ULTRA_MODEL") || {
      log "    judge-c failed — treating as no open findings"
      judge_c_result='{"verdict":"PASS","findings":[]}'
    }
    JUDGE_OPEN_C=$(echo "$judge_c_result" | jq -c '[.findings // [] | .[] | select(.open == true) | .id = ("judge-c:" + .id)]' 2>/dev/null || echo "[]")
    judge_c_count=$(echo "$JUDGE_OPEN_C" | jq 'length' 2>/dev/null || echo "0")
    log "    judge-c: ${judge_c_count} open finding(s)"

    # Count judges with at least one open finding
    [ "${judge_a_count:-0}" -gt 0 ] && { JUDGES_WITH_OPEN=$(( JUDGES_WITH_OPEN + 1 )); ALL_JUDGE_OPEN_FINDINGS=$(echo "$ALL_JUDGE_OPEN_FINDINGS" | jq -c ". + $JUDGE_OPEN_A" 2>/dev/null || echo "$ALL_JUDGE_OPEN_FINDINGS"); }
    [ "${judge_b_count:-0}" -gt 0 ] && { JUDGES_WITH_OPEN=$(( JUDGES_WITH_OPEN + 1 )); ALL_JUDGE_OPEN_FINDINGS=$(echo "$ALL_JUDGE_OPEN_FINDINGS" | jq -c ". + $JUDGE_OPEN_B" 2>/dev/null || echo "$ALL_JUDGE_OPEN_FINDINGS"); }
    [ "${judge_c_count:-0}" -gt 0 ] && { JUDGES_WITH_OPEN=$(( JUDGES_WITH_OPEN + 1 )); ALL_JUDGE_OPEN_FINDINGS=$(echo "$ALL_JUDGE_OPEN_FINDINGS" | jq -c ". + $JUDGE_OPEN_C" 2>/dev/null || echo "$ALL_JUDGE_OPEN_FINDINGS"); }

    ULTRA_JUDGE_OPEN_COUNT=$JUDGES_WITH_OPEN
    log "  Ultra: judges with open findings = ${JUDGES_WITH_OPEN}/3"

    if [ "$JUDGES_WITH_OPEN" -ge 2 ]; then
      log "  Ultra: ≥2/3 judges have open findings — BLOCKING (adding to surviving findings)"
      # Mark these as high severity blocking findings
      blocking_judge_findings=$(echo "$ALL_JUDGE_OPEN_FINDINGS" | jq -c '[.[] | .severity = "high"]' 2>/dev/null || echo "$ALL_JUDGE_OPEN_FINDINGS")
      SURVIVING_FINDINGS=$(echo "$SURVIVING_FINDINGS" | jq -c ". + $blocking_judge_findings" 2>/dev/null || echo "$SURVIVING_FINDINGS")
      # If evaluators agreed on PASS but judges block → downgrade to FAIL
      if [ -z "$ULTRA_FINAL_VERDICT" ] || [ "$ULTRA_FINAL_VERDICT" = "" ]; then
        ULTRA_FINAL_VERDICT="FAIL"
      fi
    else
      log "  Ultra: ${JUDGES_WITH_OPEN}/3 judges have open findings — advisory only (non-blocking)"
      # Advisory findings: add as info severity, open=false (they are logged but don't block)
      if [ "$JUDGES_WITH_OPEN" -gt 0 ]; then
        advisory_judge_findings=$(echo "$ALL_JUDGE_OPEN_FINDINGS" | jq -c '[.[] | .severity = "info" | .open = false]' 2>/dev/null || echo "[]")
        SURVIVING_FINDINGS=$(echo "$SURVIVING_FINDINGS" | jq -c ". + $advisory_judge_findings" 2>/dev/null || echo "$SURVIVING_FINDINGS")
      fi
      # If evaluators agreed PASS and judge panel is advisory-only → keep PASS
      # (ULTRA_FINAL_VERDICT stays empty → Phase 6 computes normally from FINAL_OPEN)
    fi
  fi

  log "Ultra panel complete: eval_a=${ULTRA_EVAL_A_VERDICT} eval_b=${ULTRA_EVAL_B_VERDICT} agreed=${ULTRA_AGREED} judge_open=${ULTRA_JUDGE_OPEN_COUNT} verdict_override=${ULTRA_FINAL_VERDICT:-none}"
fi

# ---------------------------------------------------------------------------
# Phase 6: Compute final verdict
# ---------------------------------------------------------------------------

FINAL_OPEN=$(echo "$SURVIVING_FINDINGS" | jq '[.[] | select(.open == true)] | length' 2>/dev/null || echo "0")
CRITICAL_OR_HIGH=$(echo "$SURVIVING_FINDINGS" | \
  jq '[.[] | select(.open == true and (.severity == "critical" or .severity == "high"))] | length' \
  2>/dev/null || echo "0")

# Ultra override: if the ultra panel set a verdict, honor it (ESCALATE / FAIL takes precedence)
if [ -n "${ULTRA_FINAL_VERDICT:-}" ]; then
  FINAL_VERDICT="$ULTRA_FINAL_VERDICT"
  log "Ultra verdict override: ${FINAL_VERDICT}"
elif [ "$FINAL_OPEN" -eq 0 ]; then
  FINAL_VERDICT="PASS"
elif [ "$LENS_ERRORS" -ge "$LENS_COUNT" ]; then
  FINAL_VERDICT="FAIL"
  log "All lenses errored — hard fail"
else
  FINAL_VERDICT="FAIL"
fi

# ---------------------------------------------------------------------------
# Phase 6.5 (Ultra only): Emit verify_panel_ultra audit event
# ---------------------------------------------------------------------------
# Emitted here (after Phase 6) so final_verdict reflects the fully resolved verdict.

if [[ "${POSTURE}" == judge-panel* ]]; then
  if command -v jq >/dev/null 2>&1; then
    jq -n -c \
      --arg ts "$TS" \
      --arg epic "$EPIC_ID" \
      --arg eval_a "${ULTRA_EVAL_A_VERDICT:-unknown}" \
      --arg eval_b "${ULTRA_EVAL_B_VERDICT:-unknown}" \
      --argjson agreed "${ULTRA_AGREED:-false}" \
      --argjson judge_open_count "${ULTRA_JUDGE_OPEN_COUNT:-0}" \
      --arg final_verdict "$FINAL_VERDICT" \
      '{ts:$ts,event:"verify_panel_ultra",epic:$epic,evaluator_a_verdict:$eval_a,evaluator_b_verdict:$eval_b,agreed:$agreed,judge_open_count:$judge_open_count,final_verdict:$final_verdict}' \
      >> "$AUDIT_LOG" 2>/dev/null || true
  fi
fi

# ---------------------------------------------------------------------------
# Phase 7: Emit verify_panel_result audit event
# ---------------------------------------------------------------------------

emit_audit verify_panel_result \
  "epic=${EPIC_ID}" \
  "verdict=${FINAL_VERDICT}" \
  "refuted_count=${REFUTED_COUNT}" \
  "lens_count=${LENS_COUNT}" \
  "open_count=${FINAL_OPEN}" || true

# ---------------------------------------------------------------------------
# Phase 8: Output report
# ---------------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  verify-panel REPORT — Epic ${EPIC_ID} — Posture: ${POSTURE}"
echo "============================================================"
echo ""
echo "FINAL VERDICT: ${FINAL_VERDICT}"
echo ""
echo "Lens verdicts:"
for i in 0 1 2 3; do
  echo "  [${LENS_NAMES[$i]}]: ${LENS_VERDICTS[$i]:-unknown}"
done
echo ""
echo "Refute pass:"
echo "  open findings before refute: ${OPEN_COUNT}"
echo "  dropped by majority refute:  ${REFUTED_COUNT}"
echo "  surviving open findings:     ${FINAL_OPEN}"
echo ""

if [ "$FINAL_OPEN" -gt 0 ]; then
  echo "Surviving open findings:"
  echo "$SURVIVING_FINDINGS" | jq -r '
    .[] | select(.open == true) |
    "  [\(.severity | ascii_upcase)] \(.id)\n    \(.evidence)"
  ' 2>/dev/null || echo "$SURVIVING_FINDINGS"
  echo ""
fi

COMPLETENESS_COUNT=$(echo "$COMPLETENESS_FLAGGED" | jq 'length' 2>/dev/null || echo "0")
if [ "$COMPLETENESS_COUNT" -gt 0 ]; then
  echo "Completeness critic flags:"
  echo "$COMPLETENESS_FLAGGED" | jq -r '.[] | "  [COMPLETENESS] \(.id): \(.evidence)"' 2>/dev/null
  echo ""
fi

# Ultra panel summary (only shown when ultra was active)
if [[ "${POSTURE}" == judge-panel* ]]; then
  echo "Ultra panel:"
  echo "  evaluator A verdict: ${ULTRA_EVAL_A_VERDICT:-n/a}"
  echo "  evaluator B verdict: ${ULTRA_EVAL_B_VERDICT:-n/a}"
  echo "  evaluators agreed:   ${ULTRA_AGREED:-n/a}"
  echo "  judges with open:    ${ULTRA_JUDGE_OPEN_COUNT:-0}/3"
  if [ "$FINAL_VERDICT" = "ESCALATE" ]; then
    echo ""
    echo "  ESCALATE: evaluators disagreed — needs_human review required."
    echo "  Evaluator A: ${ULTRA_EVAL_A_VERDICT:-n/a} | Evaluator B: ${ULTRA_EVAL_B_VERDICT:-n/a}"
    echo "  Do NOT auto-advance this epic. Human review is required before merge."
  fi
  echo ""
fi

echo "Audit: verify_panel_start + verify_panel_result emitted to ${AUDIT_LOG}"
echo "============================================================"

# Cleanup state file on PASS (FAIL/ESCALATE keeps it for re-runs)
if [ "$FINAL_VERDICT" = "PASS" ]; then
  rm -f "$STATE_FILE" 2>/dev/null || true
fi

# Exit codes: PASS=0, STUCK=0 (handled above), FAIL=1, ESCALATE=1
[ "$FINAL_VERDICT" = "PASS" ] && exit 0
exit 1
