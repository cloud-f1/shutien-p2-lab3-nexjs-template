#!/bin/bash
# test-coverage-drop.sh — TDD fixtures for audit-emit-coverage-drop.sh (E199)
#
# Tests:
#   1. Cap-hit path emits valid JSON with all 5 fields (ts/event/what/reason/tier)
#   2. event=coverage_dropped
#   3. Missing-arg exits non-zero, no JSON written
#   4. what/reason/tier fields match input args
#   5. Batch-callsite scenario (what=batch_concurrency reason=worktree_isolation_broken tier=orchestration)
#   6. Reviewer-callsite scenario (what=reviewer_loop reason=MAX_ITERATIONS_reached tier=review)
#
# Target: <2s runtime. Uses AUDIT_LOG_PATH temp file for isolation.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EMIT_SH="$SCRIPT_DIR/audit-emit-coverage-drop.sh"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

# ---- helpers ----------------------------------------------------------------

make_log() {
  mktemp
}

# Run emit with a temp log, return the log path via stdout.
run_emit() {
  local log="$1"; shift
  AUDIT_LOG_PATH="$log" CLOCK_TS="2026-06-01T00:00:00Z" \
    bash "$EMIT_SH" "$@" 2>/dev/null
}

# ---- Test 1: cap-hit path emits valid JSON with all 5 fields ----------------

LOG=$(make_log)
run_emit "$LOG" batch_concurrency worktree_isolation_broken orchestration
if [ -s "$LOG" ]; then
  # jq validates the line is parseable and all 5 fields are present
  HAS_ALL=$(jq -r '
    if (.ts != null and .event != null and .what != null and .reason != null and .tier != null)
    then "yes" else "no" end
  ' "$LOG" 2>/dev/null)
  if [ "$HAS_ALL" = "yes" ]; then
    pass "Test 1: all 5 fields present in emitted JSON"
  else
    fail "Test 1: one or more required fields missing — $(cat "$LOG")"
  fi
else
  fail "Test 1: no JSON line emitted (log empty)"
fi
rm -f "$LOG"

# ---- Test 2: event=coverage_dropped -----------------------------------------

LOG=$(make_log)
run_emit "$LOG" reviewer_loop MAX_ITERATIONS_reached review
EVENT=$(jq -r '.event' "$LOG" 2>/dev/null)
if [ "$EVENT" = "coverage_dropped" ]; then
  pass "Test 2: event field equals coverage_dropped"
else
  fail "Test 2: expected event=coverage_dropped, got '${EVENT}'"
fi
rm -f "$LOG"

# ---- Test 3: missing-arg exits non-zero, no JSON written --------------------

LOG=$(make_log)
# Call with only 2 args (missing tier) — should exit non-zero
AUDIT_LOG_PATH="$LOG" bash "$EMIT_SH" only_what only_reason 2>/dev/null
EXIT_CODE=$?
# The test: must exit non-zero
if [ "$EXIT_CODE" -ne 0 ]; then
  pass "Test 3a: missing tier arg exits non-zero (exit=$EXIT_CODE)"
else
  fail "Test 3a: expected non-zero exit for missing tier arg, got 0"
fi
# Also check no JSON was written (file should be empty)
if [ ! -s "$LOG" ]; then
  pass "Test 3b: no JSON written when required arg missing"
else
  fail "Test 3b: JSON was written despite missing arg — $(cat "$LOG")"
fi
rm -f "$LOG"

# Call with 0 args — should also exit non-zero
LOG=$(make_log)
AUDIT_LOG_PATH="$LOG" bash "$EMIT_SH" 2>/dev/null
EXIT_CODE=$?
if [ "$EXIT_CODE" -ne 0 ]; then
  pass "Test 3c: zero args exits non-zero"
else
  fail "Test 3c: expected non-zero for zero args, got 0"
fi
rm -f "$LOG"

# ---- Test 4: what/reason/tier fields match input args -----------------------

LOG=$(make_log)
run_emit "$LOG" my_what my_reason my_tier
WHAT=$(jq -r '.what' "$LOG" 2>/dev/null)
REASON=$(jq -r '.reason' "$LOG" 2>/dev/null)
TIER=$(jq -r '.tier' "$LOG" 2>/dev/null)
if [ "$WHAT" = "my_what" ] && [ "$REASON" = "my_reason" ] && [ "$TIER" = "my_tier" ]; then
  pass "Test 4: what/reason/tier fields match input args"
else
  fail "Test 4: field mismatch — what='$WHAT' reason='$REASON' tier='$TIER'"
fi
rm -f "$LOG"

# ---- Test 5: batch-callsite scenario ----------------------------------------

LOG=$(make_log)
run_emit "$LOG" batch_concurrency worktree_isolation_broken orchestration
WHAT=$(jq -r '.what' "$LOG" 2>/dev/null)
REASON=$(jq -r '.reason' "$LOG" 2>/dev/null)
TIER=$(jq -r '.tier' "$LOG" 2>/dev/null)
EVENT=$(jq -r '.event' "$LOG" 2>/dev/null)
if [ "$EVENT" = "coverage_dropped" ] && \
   [ "$WHAT" = "batch_concurrency" ] && \
   [ "$REASON" = "worktree_isolation_broken" ] && \
   [ "$TIER" = "orchestration" ]; then
  pass "Test 5: batch-callsite scenario emits correct fields"
else
  fail "Test 5: batch callsite mismatch — event='$EVENT' what='$WHAT' reason='$REASON' tier='$TIER'"
fi
rm -f "$LOG"

# ---- Test 6: reviewer-callsite scenario -------------------------------------

LOG=$(make_log)
run_emit "$LOG" reviewer_loop MAX_ITERATIONS_reached review
WHAT=$(jq -r '.what' "$LOG" 2>/dev/null)
REASON=$(jq -r '.reason' "$LOG" 2>/dev/null)
TIER=$(jq -r '.tier' "$LOG" 2>/dev/null)
EVENT=$(jq -r '.event' "$LOG" 2>/dev/null)
if [ "$EVENT" = "coverage_dropped" ] && \
   [ "$WHAT" = "reviewer_loop" ] && \
   [ "$REASON" = "MAX_ITERATIONS_reached" ] && \
   [ "$TIER" = "review" ]; then
  pass "Test 6: reviewer-callsite scenario emits correct fields"
else
  fail "Test 6: reviewer callsite mismatch — event='$EVENT' what='$WHAT' reason='$REASON' tier='$TIER'"
fi
rm -f "$LOG"

# ---- Summary ----------------------------------------------------------------

TOTAL=$((PASS + FAIL))
echo ""
echo "Results: $PASS/$TOTAL passed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
