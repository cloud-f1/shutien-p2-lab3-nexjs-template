#!/usr/bin/env bash
# Fixture-driven unit tests for scripts/effort/resolve.sh
#
# Tests:
#   - Precedence: --effort flag beats $ATHENA_EFFORT env beats default
#   - All 4 tiers produce correct knob values
#   - Fallback: no args + ATHENA_EFFORT unset → standard defaults
#   - Audit event source field (flag | env | default)
#   - standard tier is backward-compatible with today's hardcoded values
#
# Run: bash scripts/effort/tests/test-resolve.sh
# Must pass in <3s

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOLVE="$SCRIPT_DIR/../resolve.sh"

if [ ! -f "$RESOLVE" ]; then
  echo "FAIL: resolve.sh not found at $RESOLVE" >&2
  exit 1
fi

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() {
  echo "FAIL: $1"
  echo "  Expected: $2"
  echo "  Got:      $3"
  FAIL=$((FAIL + 1))
}

# Temp audit log for each test (avoid polluting real .claude/audit.jsonl)
TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

# Helper: eval resolve output for a given tier and return the variable value
# Usage: eval_knob <tier> <var_name> [extra_env]
eval_knob() {
  local tier="$1" var="$2" extra_env="${3:-}"
  local audit_log="$TMPDIR_TEST/audit-$tier-$var-$RANDOM.jsonl"
  local out
  if [ -n "$extra_env" ]; then
    out=$(env -i PATH="$PATH" HOME="$HOME" $extra_env \
      AUDIT_LOG_PATH="$audit_log" \
      bash "$RESOLVE" "--effort" "$tier" 2>/dev/null)
  else
    out=$(env -i PATH="$PATH" HOME="$HOME" \
      AUDIT_LOG_PATH="$audit_log" \
      bash "$RESOLVE" "--effort" "$tier" 2>/dev/null)
  fi
  echo "$out" | grep "^export ${var}=" | sed "s/^export ${var}=//" | tr -d '"'
}

# Helper: eval resolve with env var (no --effort flag)
eval_knob_env() {
  local tier="$1" var="$2"
  local audit_log="$TMPDIR_TEST/audit-env-$tier-$var-$RANDOM.jsonl"
  env -i PATH="$PATH" HOME="$HOME" \
    ATHENA_EFFORT="$tier" \
    AUDIT_LOG_PATH="$audit_log" \
    bash "$RESOLVE" 2>/dev/null \
  | grep "^export ${var}=" | sed "s/^export ${var}=//" | tr -d '"'
}

# Helper: eval resolve with no args, no ATHENA_EFFORT (default)
eval_knob_default() {
  local var="$1"
  local audit_log="$TMPDIR_TEST/audit-default-$var-$RANDOM.jsonl"
  env -i PATH="$PATH" HOME="$HOME" \
    AUDIT_LOG_PATH="$audit_log" \
    bash "$RESOLVE" 2>/dev/null \
  | grep "^export ${var}=" | sed "s/^export ${var}=//" | tr -d '"'
}

# Helper: get the source field from audit event
get_audit_source() {
  local audit_log="$1"
  [ -f "$audit_log" ] && grep -o '"source":"[^"]*"' "$audit_log" | sed 's/"source":"//;s/"//' | head -1 || echo ""
}

# Helper: get the tier field from audit event
get_audit_tier() {
  local audit_log="$1"
  [ -f "$audit_log" ] && grep -o '"tier":"[^"]*"' "$audit_log" | sed 's/"tier":"//;s/"//' | head -1 || echo ""
}

# Helper: get audit event field
get_audit_event() {
  local audit_log="$1"
  [ -f "$audit_log" ] && grep -o '"event":"[^"]*"' "$audit_log" | sed 's/"event":"//;s/"//' | head -1 || echo ""
}

# ===========================================================================
# SECTION 1: Precedence tests
# ===========================================================================

# Test: --effort flag beats $ATHENA_EFFORT env
audit_log="$TMPDIR_TEST/audit-prec1.jsonl"
out=$(env -i PATH="$PATH" HOME="$HOME" ATHENA_EFFORT=thorough AUDIT_LOG_PATH="$audit_log" \
  bash "$RESOLVE" "--effort" "quick" 2>/dev/null)
val=$(echo "$out" | grep "^export MAX_ITERATIONS=" | sed 's/^export MAX_ITERATIONS=//' | tr -d '"')
if [ "$val" = "1" ]; then
  pass "precedence: --effort quick beats ATHENA_EFFORT=thorough (MAX_ITERATIONS=1)"
else
  fail "precedence: --effort quick beats ATHENA_EFFORT=thorough" "MAX_ITERATIONS=1" "$val"
fi

# Test: source=flag when --effort is used
src=$(get_audit_source "$audit_log")
if [ "$src" = "flag" ]; then
  pass "source=flag when --effort flag provided"
else
  fail "source=flag when --effort flag provided" "flag" "$src"
fi

# Test: $ATHENA_EFFORT beats default (standard)
audit_log="$TMPDIR_TEST/audit-prec2.jsonl"
out=$(env -i PATH="$PATH" HOME="$HOME" ATHENA_EFFORT=thorough AUDIT_LOG_PATH="$audit_log" \
  bash "$RESOLVE" 2>/dev/null)
val=$(echo "$out" | grep "^export MAX_ITERATIONS=" | sed 's/^export MAX_ITERATIONS=//' | tr -d '"')
if [ "$val" = "6" ]; then
  pass "precedence: ATHENA_EFFORT=thorough beats default (MAX_ITERATIONS=6)"
else
  fail "precedence: ATHENA_EFFORT=thorough beats default" "MAX_ITERATIONS=6" "$val"
fi

# Test: source=env when ATHENA_EFFORT env is used
src=$(get_audit_source "$audit_log")
if [ "$src" = "env" ]; then
  pass "source=env when ATHENA_EFFORT env var used"
else
  fail "source=env when ATHENA_EFFORT env var used" "env" "$src"
fi

# Test: no args, no ATHENA_EFFORT → standard default
audit_log="$TMPDIR_TEST/audit-default.jsonl"
out=$(env -i PATH="$PATH" HOME="$HOME" AUDIT_LOG_PATH="$audit_log" \
  bash "$RESOLVE" 2>/dev/null)
val=$(echo "$out" | grep "^export MAX_CONCURRENT=" | sed 's/^export MAX_CONCURRENT=//' | tr -d '"')
if [ "$val" = "4" ]; then
  pass "fallback: no args + ATHENA_EFFORT unset → standard (MAX_CONCURRENT=4)"
else
  fail "fallback: no args + ATHENA_EFFORT unset → standard" "MAX_CONCURRENT=4" "$val"
fi

# Test: source=default when no flag/env
src=$(get_audit_source "$audit_log")
if [ "$src" = "default" ]; then
  pass "source=default when no flag or env"
else
  fail "source=default when no flag or env" "default" "$src"
fi

# ===========================================================================
# SECTION 2: quick tier knob values
# ===========================================================================

val=$(eval_knob quick MAX_CONCURRENT)
[ "$val" = "1" ] && pass "quick: MAX_CONCURRENT=1" || fail "quick: MAX_CONCURRENT" "1" "$val"

val=$(eval_knob quick MAX_ITERATIONS)
[ "$val" = "1" ] && pass "quick: MAX_ITERATIONS=1" || fail "quick: MAX_ITERATIONS" "1" "$val"

val=$(eval_knob quick REVIEW_LOOP_BUDGET)
[ "$val" = "15000" ] && pass "quick: REVIEW_LOOP_BUDGET=15000" || fail "quick: REVIEW_LOOP_BUDGET" "15000" "$val"

val=$(eval_knob quick AUTOPILOT_THRESHOLD)
[ "$val" = "0.80" ] && pass "quick: AUTOPILOT_THRESHOLD=0.80" || fail "quick: AUTOPILOT_THRESHOLD" "0.80" "$val"

val=$(eval_knob quick ATHENA_VERIFY_POSTURE)
[ "$val" = "single-vote" ] && pass "quick: ATHENA_VERIFY_POSTURE=single-vote" || fail "quick: ATHENA_VERIFY_POSTURE" "single-vote" "$val"

val=$(eval_knob quick ATHENA_MODEL_MAP)
if echo "$val" | grep -q "reviewer=haiku" && echo "$val" | grep -q "evaluator=sonnet"; then
  pass "quick: ATHENA_MODEL_MAP contains reviewer=haiku,evaluator=sonnet"
else
  fail "quick: ATHENA_MODEL_MAP" "reviewer=haiku,...evaluator=sonnet" "$val"
fi

# ===========================================================================
# SECTION 3: standard tier knob values (BACKWARD-COMPAT CRITICAL)
# ===========================================================================

val=$(eval_knob standard MAX_CONCURRENT)
[ "$val" = "4" ] && pass "standard: MAX_CONCURRENT=4 (backward-compat)" || fail "standard: MAX_CONCURRENT" "4" "$val"

val=$(eval_knob standard MAX_ITERATIONS)
[ "$val" = "4" ] && pass "standard: MAX_ITERATIONS=4 (backward-compat)" || fail "standard: MAX_ITERATIONS" "4" "$val"

val=$(eval_knob standard REVIEW_LOOP_BUDGET)
[ "$val" = "50000" ] && pass "standard: REVIEW_LOOP_BUDGET=50000 (backward-compat)" || fail "standard: REVIEW_LOOP_BUDGET" "50000" "$val"

val=$(eval_knob standard AUTOPILOT_THRESHOLD)
[ "$val" = "0.85" ] && pass "standard: AUTOPILOT_THRESHOLD=0.85 (backward-compat)" || fail "standard: AUTOPILOT_THRESHOLD" "0.85" "$val"

val=$(eval_knob standard ATHENA_VERIFY_POSTURE)
[ "$val" = "single-vote" ] && pass "standard: ATHENA_VERIFY_POSTURE=single-vote" || fail "standard: ATHENA_VERIFY_POSTURE" "single-vote" "$val"

val=$(eval_knob standard ATHENA_MODEL_MAP)
if echo "$val" | grep -q "reviewer=sonnet" && echo "$val" | grep -q "evaluator=sonnet"; then
  pass "standard: ATHENA_MODEL_MAP contains reviewer=sonnet,evaluator=sonnet"
else
  fail "standard: ATHENA_MODEL_MAP" "reviewer=sonnet,...evaluator=sonnet" "$val"
fi

# ===========================================================================
# SECTION 4: thorough tier knob values
# ===========================================================================

val=$(eval_knob thorough MAX_CONCURRENT)
[ "$val" = "4" ] && pass "thorough: MAX_CONCURRENT=4" || fail "thorough: MAX_CONCURRENT" "4" "$val"

val=$(eval_knob thorough MAX_ITERATIONS)
[ "$val" = "6" ] && pass "thorough: MAX_ITERATIONS=6" || fail "thorough: MAX_ITERATIONS" "6" "$val"

val=$(eval_knob thorough REVIEW_LOOP_BUDGET)
[ "$val" = "150000" ] && pass "thorough: REVIEW_LOOP_BUDGET=150000" || fail "thorough: REVIEW_LOOP_BUDGET" "150000" "$val"

val=$(eval_knob thorough AUTOPILOT_THRESHOLD)
[ "$val" = "0.90" ] && pass "thorough: AUTOPILOT_THRESHOLD=0.90" || fail "thorough: AUTOPILOT_THRESHOLD" "0.90" "$val"

val=$(eval_knob thorough ATHENA_VERIFY_POSTURE)
[ "$val" = "adversarial-3+perspective" ] && pass "thorough: ATHENA_VERIFY_POSTURE=adversarial-3+perspective" || fail "thorough: ATHENA_VERIFY_POSTURE" "adversarial-3+perspective" "$val"

val=$(eval_knob thorough ATHENA_MODEL_MAP)
if echo "$val" | grep -q "reviewer=sonnet" && echo "$val" | grep -q "evaluator=opus"; then
  pass "thorough: ATHENA_MODEL_MAP contains reviewer=sonnet,evaluator=opus"
else
  fail "thorough: ATHENA_MODEL_MAP" "reviewer=sonnet,...evaluator=opus" "$val"
fi

# ===========================================================================
# SECTION 5: ultra tier knob values
# ===========================================================================

# Ultra MAX_CONCURRENT is cores-aware; just check it's a positive integer
val=$(eval_knob ultra MAX_CONCURRENT)
if echo "$val" | grep -qE '^[0-9]+$' && [ "$val" -ge 1 ] && [ "$val" -le 16 ]; then
  pass "ultra: MAX_CONCURRENT is int in [1,16] (got $val)"
else
  fail "ultra: MAX_CONCURRENT is int in [1,16]" "1-16" "$val"
fi

val=$(eval_knob ultra MAX_ITERATIONS)
[ "$val" = "8" ] && pass "ultra: MAX_ITERATIONS=8" || fail "ultra: MAX_ITERATIONS" "8" "$val"

val=$(eval_knob ultra REVIEW_LOOP_BUDGET)
[ "$val" = "500000" ] && pass "ultra: REVIEW_LOOP_BUDGET=500000" || fail "ultra: REVIEW_LOOP_BUDGET" "500000" "$val"

val=$(eval_knob ultra AUTOPILOT_THRESHOLD)
[ "$val" = "0.95" ] && pass "ultra: AUTOPILOT_THRESHOLD=0.95" || fail "ultra: AUTOPILOT_THRESHOLD" "0.95" "$val"

val=$(eval_knob ultra ATHENA_VERIFY_POSTURE)
[ "$val" = "judge-panel+adversarial+multimodal" ] && pass "ultra: ATHENA_VERIFY_POSTURE=judge-panel+adversarial+multimodal" || fail "ultra: ATHENA_VERIFY_POSTURE" "judge-panel+adversarial+multimodal" "$val"

val=$(eval_knob ultra ATHENA_MODEL_MAP)
if echo "$val" | grep -q "reviewer=opus" && echo "$val" | grep -q "evaluator=opus"; then
  pass "ultra: ATHENA_MODEL_MAP contains reviewer=opus,evaluator=opus"
else
  fail "ultra: ATHENA_MODEL_MAP" "reviewer=opus,...evaluator=opus" "$val"
fi

# ===========================================================================
# SECTION 6: Audit event correctness
# ===========================================================================

# audit event: tier field matches requested tier
audit_log="$TMPDIR_TEST/audit-tier-check.jsonl"
env -i PATH="$PATH" HOME="$HOME" AUDIT_LOG_PATH="$audit_log" \
  bash "$RESOLVE" "--effort" "thorough" >/dev/null 2>&1
tier=$(get_audit_tier "$audit_log")
[ "$tier" = "thorough" ] && pass "audit event: tier=thorough" || fail "audit event: tier" "thorough" "$tier"

# audit event: event type is effort_resolved
evt=$(get_audit_event "$audit_log")
[ "$evt" = "effort_resolved" ] && pass "audit event: event=effort_resolved" || fail "audit event: event" "effort_resolved" "$evt"

# audit event: emitted even for default (standard)
audit_log="$TMPDIR_TEST/audit-default2.jsonl"
env -i PATH="$PATH" HOME="$HOME" AUDIT_LOG_PATH="$audit_log" \
  bash "$RESOLVE" >/dev/null 2>&1
evt=$(get_audit_event "$audit_log")
[ "$evt" = "effort_resolved" ] && pass "audit event: emitted for default invocation" || fail "audit event: emitted for default" "effort_resolved" "$evt"

# ===========================================================================
# SECTION 6b: Audit event enrichment (E207) — 3 new fields
# ===========================================================================

# Helper: get a named field from the audit event JSON (requires jq)
get_audit_field_jq() {
  local audit_log="$1" field="$2"
  if command -v jq >/dev/null 2>&1 && [ -f "$audit_log" ]; then
    jq -r ".${field} // empty" "$audit_log" 2>/dev/null | head -1
  else
    echo ""
  fi
}

if command -v jq >/dev/null 2>&1; then
  # --- quick tier enrichment ---
  audit_log="$TMPDIR_TEST/audit-enrich-quick.jsonl"
  env -i PATH="$PATH" HOME="$HOME" AUDIT_LOG_PATH="$audit_log" \
    bash "$RESOLVE" "--effort" "quick" >/dev/null 2>&1

  mm=$(get_audit_field_jq "$audit_log" "model_map")
  if echo "$mm" | grep -q "reviewer=haiku" && echo "$mm" | grep -q "evaluator=sonnet"; then
    pass "audit event (quick): model_map contains reviewer=haiku,evaluator=sonnet"
  else
    fail "audit event (quick): model_map" "reviewer=haiku,...evaluator=sonnet" "$mm"
  fi

  mc=$(get_audit_field_jq "$audit_log" "max_concurrent")
  [ "$mc" = "1" ] && pass "audit event (quick): max_concurrent=1" || \
    fail "audit event (quick): max_concurrent" "1" "$mc"

  vp=$(get_audit_field_jq "$audit_log" "verify_posture")
  [ "$vp" = "single-vote" ] && pass "audit event (quick): verify_posture=single-vote" || \
    fail "audit event (quick): verify_posture" "single-vote" "$vp"

  # --- standard tier enrichment ---
  audit_log="$TMPDIR_TEST/audit-enrich-standard.jsonl"
  env -i PATH="$PATH" HOME="$HOME" AUDIT_LOG_PATH="$audit_log" \
    bash "$RESOLVE" "--effort" "standard" >/dev/null 2>&1

  mm=$(get_audit_field_jq "$audit_log" "model_map")
  if echo "$mm" | grep -q "reviewer=sonnet" && echo "$mm" | grep -q "evaluator=sonnet"; then
    pass "audit event (standard): model_map contains reviewer=sonnet,evaluator=sonnet"
  else
    fail "audit event (standard): model_map" "reviewer=sonnet,...evaluator=sonnet" "$mm"
  fi

  mc=$(get_audit_field_jq "$audit_log" "max_concurrent")
  [ "$mc" = "4" ] && pass "audit event (standard): max_concurrent=4" || \
    fail "audit event (standard): max_concurrent" "4" "$mc"

  vp=$(get_audit_field_jq "$audit_log" "verify_posture")
  [ "$vp" = "single-vote" ] && pass "audit event (standard): verify_posture=single-vote" || \
    fail "audit event (standard): verify_posture" "single-vote" "$vp"

  # --- thorough tier enrichment ---
  audit_log="$TMPDIR_TEST/audit-enrich-thorough.jsonl"
  env -i PATH="$PATH" HOME="$HOME" AUDIT_LOG_PATH="$audit_log" \
    bash "$RESOLVE" "--effort" "thorough" >/dev/null 2>&1

  mm=$(get_audit_field_jq "$audit_log" "model_map")
  if echo "$mm" | grep -q "reviewer=sonnet" && echo "$mm" | grep -q "evaluator=opus"; then
    pass "audit event (thorough): model_map contains reviewer=sonnet,evaluator=opus"
  else
    fail "audit event (thorough): model_map" "reviewer=sonnet,...evaluator=opus" "$mm"
  fi

  mc=$(get_audit_field_jq "$audit_log" "max_concurrent")
  [ "$mc" = "4" ] && pass "audit event (thorough): max_concurrent=4" || \
    fail "audit event (thorough): max_concurrent" "4" "$mc"

  vp=$(get_audit_field_jq "$audit_log" "verify_posture")
  [ "$vp" = "adversarial-3+perspective" ] && pass "audit event (thorough): verify_posture=adversarial-3+perspective" || \
    fail "audit event (thorough): verify_posture" "adversarial-3+perspective" "$vp"

  # --- ultra tier enrichment ---
  audit_log="$TMPDIR_TEST/audit-enrich-ultra.jsonl"
  env -i PATH="$PATH" HOME="$HOME" AUDIT_LOG_PATH="$audit_log" \
    bash "$RESOLVE" "--effort" "ultra" >/dev/null 2>&1

  mm=$(get_audit_field_jq "$audit_log" "model_map")
  if echo "$mm" | grep -q "reviewer=opus" && echo "$mm" | grep -q "evaluator=opus"; then
    pass "audit event (ultra): model_map contains reviewer=opus,evaluator=opus"
  else
    fail "audit event (ultra): model_map" "reviewer=opus,...evaluator=opus" "$mm"
  fi

  mc=$(get_audit_field_jq "$audit_log" "max_concurrent")
  if echo "$mc" | grep -qE '^[0-9]+$' && [ "$mc" -ge 1 ] && [ "$mc" -le 16 ]; then
    pass "audit event (ultra): max_concurrent is int in [1,16] (got $mc)"
  else
    fail "audit event (ultra): max_concurrent is int in [1,16]" "1-16" "$mc"
  fi

  vp=$(get_audit_field_jq "$audit_log" "verify_posture")
  [ "$vp" = "judge-panel+adversarial+multimodal" ] && \
    pass "audit event (ultra): verify_posture=judge-panel+adversarial+multimodal" || \
    fail "audit event (ultra): verify_posture" "judge-panel+adversarial+multimodal" "$vp"

else
  echo "NOTE: jq not available — skipping E207 enrichment field assertions (12 tests skipped)"
fi

# ===========================================================================
# SECTION 7: Standard backward-compat explicit assertion
# ===========================================================================

# eval all standard knobs in one shot to cross-check
audit_log="$TMPDIR_TEST/audit-std-compat.jsonl"
std_out=$(env -i PATH="$PATH" HOME="$HOME" AUDIT_LOG_PATH="$audit_log" \
  bash "$RESOLVE" "--effort" "standard" 2>/dev/null)

mc=$(echo "$std_out" | grep "^export MAX_CONCURRENT=" | sed 's/^export MAX_CONCURRENT=//' | tr -d '"')
mi=$(echo "$std_out" | grep "^export MAX_ITERATIONS=" | sed 's/^export MAX_ITERATIONS=//' | tr -d '"')
rlb=$(echo "$std_out" | grep "^export REVIEW_LOOP_BUDGET=" | sed 's/^export REVIEW_LOOP_BUDGET=//' | tr -d '"')
at=$(echo "$std_out" | grep "^export AUTOPILOT_THRESHOLD=" | sed 's/^export AUTOPILOT_THRESHOLD=//' | tr -d '"')

if [ "$mc" = "4" ] && [ "$mi" = "4" ] && [ "$rlb" = "50000" ] && [ "$at" = "0.85" ]; then
  pass "standard backward-compat: all 4 core knobs match hardcoded values"
else
  fail "standard backward-compat" \
    "MAX_CONCURRENT=4 MAX_ITERATIONS=4 REVIEW_LOOP_BUDGET=50000 AUTOPILOT_THRESHOLD=0.85" \
    "MAX_CONCURRENT=$mc MAX_ITERATIONS=$mi REVIEW_LOOP_BUDGET=$rlb AUTOPILOT_THRESHOLD=$at"
fi

# ===========================================================================
# Summary
# ===========================================================================

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  echo "All tests passed."
  exit 0
fi
