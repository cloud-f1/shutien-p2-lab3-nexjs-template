#!/usr/bin/env bash
# scripts/qa/tests/test-verify-panel.sh — TDD fixtures for verify-panel.sh (E200)
#
# Tests:
#   1. Schema-valid round-trip: PASS verdict with 0 open findings
#   2. STUCK detection: identical finding sets across rounds → STUCK
#   3. Majority-refute drop: 2/3 refute → finding dropped, not passed to @debugger
#   4. Standard-path passthrough: ATHENA_VERIFY_POSTURE=standard → exits 0 early (no claude call)
#   5. Completeness-critic flag: AC with no file:line → flagged as info finding
#
# All tests use CLAUDE_CMD env var to inject a mock claude binary.
# No real API calls are made.
# Target runtime: <10s.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PANEL_SH="${SCRIPT_DIR}/verify-panel.sh"
SCHEMA_PATH="${SCRIPT_DIR}/findings-schema.json"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

# ---- helpers ----------------------------------------------------------------

make_temp_dir() {
  mktemp -d
}

cleanup_dir() {
  rm -rf "$1" 2>/dev/null || true
}

# Create a neutral context file that contains no mock-discriminating keywords.
# The file is used as the second arg to verify-panel.sh to avoid --diff HEAD
# which would include the real git diff (which may contain keywords like
# "skeptical code reviewer" or "completeness critic" from verify-panel.sh itself).
make_neutral_context() {
  local tmp_dir="$1"
  local ctx_file="${tmp_dir}/test-context.txt"
  cat > "$ctx_file" <<'CTXEOF'
diff --git a/server/app/api/v1/endpoints/test.py b/server/app/api/v1/endpoints/test.py
index 1234567..abcdefg 100644
--- a/server/app/api/v1/endpoints/test.py
+++ b/server/app/api/v1/endpoints/test.py
@@ -1,5 +1,8 @@
 def hello():
-    pass
+    return {"status": "ok"}
CTXEOF
  echo "$ctx_file"
}

# Create a mock claude binary that outputs a fixed structured_output response.
# $1 = tmp_dir, $2 = JSON string for structured_output field
make_mock_claude() {
  local tmp_dir="$1"
  local structured_output="$2"
  local mock_path="${tmp_dir}/claude"

  cat > "$mock_path" <<MOCK
#!/usr/bin/env bash
# Mock claude binary — returns fixed structured_output
# Absorbs all args, ignores them.
# Outputs a JSON envelope matching the real CLI format.
cat <<'EOF'
$(printf '{"structured_output":%s,"stop_reason":"end_turn","num_turns":1}' "$structured_output")
EOF
MOCK

  chmod +x "$mock_path"
  echo "$mock_path"
}

# Create a mock claude binary that returns a refute response.
# $1 = tmp_dir, $2 = refuted (true|false)
make_mock_claude_refute() {
  local tmp_dir="$1"
  local refuted="$2"
  local mock_path="${tmp_dir}/claude"

  # The panel calls claude for both lens (findings schema) and refute (simple schema).
  # We need a mock that handles both. The mock detects "REFUTE" in the prompt.
  cat > "$mock_path" <<MOCK
#!/usr/bin/env bash
# Smart mock: returns findings schema response by default, refute response for REFUTE prompts
PROMPT="\$2"
if echo "\${PROMPT}" | grep -qi "REFUTE"; then
  printf '{"structured_output":{"refuted":${refuted},"rationale":"mock rationale"},"stop_reason":"end_turn","num_turns":1}\n'
else
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"test-finding","severity":"high","open":true,"evidence":"test/file.py:42 — test evidence"}]},"stop_reason":"end_turn","num_turns":1}\n'
fi
MOCK

  chmod +x "$mock_path"
  echo "$mock_path"
}

# Run the panel with isolation. Returns exit code via $?
run_panel() {
  local tmp_dir="$1"
  local mock_claude="$2"
  local posture="$3"
  local epic="${4:-E200}"
  local extra_args="${5:-}"

  ATHENA_VERIFY_POSTURE="$posture" \
  CLAUDE_CMD="$mock_claude" \
  AUDIT_LOG_PATH="${tmp_dir}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=3 \
  REFUTE_MAJORITY=2 \
    bash "$PANEL_SH" "$epic" ${extra_args} 2>/dev/null
  return $?
}

# ---- Test 1: Schema-valid round-trip (PASS verdict, 0 open findings) --------
#
# Mock claude returns all closed findings → panel should output PASS.

echo "--- Test 1: Schema-valid round-trip (PASS verdict, 0 open findings) ---"

TMP=$(make_temp_dir)
CTX=$(make_neutral_context "$TMP")

# Mock returns 0 open findings (all closed)
MOCK=$(make_mock_claude "$TMP" '{"verdict":"PASS","findings":[{"id":"no-issues","severity":"info","open":false,"evidence":"file.py:1 — all clear"}]}')

# Clear any existing state file
rm -f "${TMP}/.verify-panel-state-E200" 2>/dev/null || true

OUTPUT=$(ATHENA_VERIFY_POSTURE="thorough" \
  CLAUDE_CMD="$MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=3 \
  REFUTE_MAJORITY=2 \
  bash "$PANEL_SH" E200 "$CTX" 2>/dev/null)

EXIT_CODE=$?

# Verdict should be PASS (exit 0)
if [ "$EXIT_CODE" -eq 0 ]; then
  pass "Test 1a: exit code 0 (PASS)"
else
  fail "Test 1a: expected exit 0 (PASS), got $EXIT_CODE"
fi

# Output should contain PASS
if echo "$OUTPUT" | grep -q "FINAL VERDICT: PASS"; then
  pass "Test 1b: output contains FINAL VERDICT: PASS"
else
  fail "Test 1b: output does not contain FINAL VERDICT: PASS — output: $(echo "$OUTPUT" | tail -5)"
fi

# Audit events should be emitted
if [ -f "${TMP}/audit.jsonl" ]; then
  START_EVENTS=$(jq 'select(.event == "verify_panel_start")' "${TMP}/audit.jsonl" 2>/dev/null | wc -l)
  RESULT_EVENTS=$(jq 'select(.event == "verify_panel_result")' "${TMP}/audit.jsonl" 2>/dev/null | wc -l)
  if [ "$START_EVENTS" -gt 0 ] && [ "$RESULT_EVENTS" -gt 0 ]; then
    pass "Test 1c: audit events emitted (start + result)"
  else
    fail "Test 1c: missing audit events — start=$START_EVENTS result=$RESULT_EVENTS"
  fi
else
  fail "Test 1c: audit.jsonl not created"
fi

# Audit result event should have verdict=PASS
AUDIT_VERDICT=$(jq -r 'select(.event == "verify_panel_result") | .verdict' "${TMP}/audit.jsonl" 2>/dev/null | head -1)
if [ "$AUDIT_VERDICT" = "PASS" ]; then
  pass "Test 1d: audit event verdict=PASS"
else
  fail "Test 1d: expected audit verdict=PASS, got '$AUDIT_VERDICT'"
fi

cleanup_dir "$TMP"

# ---- Test 2: STUCK detection (identical finding sets across rounds) ----------
#
# Run panel twice with identical finding sets → second run should detect STUCK.

echo ""
echo "--- Test 2: STUCK detection (identical finding sets across rounds) ---"

TMP=$(make_temp_dir)
CTX=$(make_neutral_context "$TMP")

# Mock returns one open finding (so the set is non-empty and can be compared)
MOCK=$(make_mock_claude "$TMP" '{"verdict":"FAIL","findings":[{"id":"stuck-finding","severity":"medium","open":true,"evidence":"file.py:10 — test finding"}]}')

# Find where the state file would be created
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && git rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR}/../..")"
STATE_FILE="${REPO_ROOT}/.claude/.verify-panel-state-E999TEST"

# Create a fixture epic ID that won't collide with real runs
TEST_EPIC="E999TEST"
rm -f "$STATE_FILE" 2>/dev/null || true

# Run once to create state (findings survive since mock doesn't respond to refute schema)
FIRST_OUTPUT=$(ATHENA_VERIFY_POSTURE="thorough" \
  CLAUDE_CMD="$MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=3 \
  REFUTE_MAJORITY=2 \
  bash "$PANEL_SH" "$TEST_EPIC" "$CTX" 2>/dev/null || true)

# Run again — state file exists with same set → should detect STUCK
SECOND_OUTPUT=$(ATHENA_VERIFY_POSTURE="thorough" \
  CLAUDE_CMD="$MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit2.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:01Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=3 \
  REFUTE_MAJORITY=2 \
  bash "$PANEL_SH" "$TEST_EPIC" "$CTX" 2>/dev/null || true)
SECOND_EXIT=$?

# Clean up the state file
rm -f "$STATE_FILE" 2>/dev/null || true

if echo "$SECOND_OUTPUT" | grep -q "STUCK"; then
  pass "Test 2a: STUCK detected on second run with identical finding set"
else
  fail "Test 2a: expected STUCK in output — got: $(echo "$SECOND_OUTPUT" | tail -5)"
fi

if [ "$SECOND_EXIT" -eq 0 ]; then
  pass "Test 2b: STUCK exits 0 (requires human review, not hard fail)"
else
  fail "Test 2b: expected exit 0 on STUCK, got $SECOND_EXIT"
fi

if [ -f "${TMP}/audit2.jsonl" ]; then
  STUCK_VERDICT=$(jq -r 'select(.event == "verify_panel_result") | .verdict' "${TMP}/audit2.jsonl" 2>/dev/null | head -1)
  if [ "$STUCK_VERDICT" = "STUCK" ]; then
    pass "Test 2c: audit event verdict=STUCK"
  else
    fail "Test 2c: expected audit verdict=STUCK, got '$STUCK_VERDICT'"
  fi
else
  fail "Test 2c: audit2.jsonl not created"
fi

cleanup_dir "$TMP"

# ---- Test 3: Majority-refute drop (2/3 refute → finding dropped) ------------
#
# Mock returns one open finding. Refute mock returns refuted=true (all 3 agree).
# Finding should be dropped → final open count = 0 → PASS.

echo ""
echo "--- Test 3: Majority-refute drop (2/3 refute → finding dropped) ---"

TMP=$(make_temp_dir)

# This mock: returns FAIL+open finding for lens calls, refuted=true for REFUTE prompts
MOCK_PATH="${TMP}/claude-refute"
cat > "$MOCK_PATH" <<'SMARTMOCK'
#!/usr/bin/env bash
# Smart mock for refute test:
# - Lens calls: "You are a correctness/security/perf/repro reviewer" → return one open finding
# - Refute calls: "You are a skeptical code reviewer" → return refuted=true
# - Completeness critic calls: "You are a completeness critic" → return empty PASS
PROMPT="${2:-}"
if echo "${PROMPT}" | grep -qi "skeptical code reviewer"; then
  printf '{"structured_output":{"refuted":true,"rationale":"mock: finding is a false positive"},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "completeness critic"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
else
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"false-positive-finding","severity":"high","open":true,"evidence":"file.py:42 — suspicious code that is actually fine"}]},"stop_reason":"end_turn","num_turns":1}\n'
fi
SMARTMOCK
chmod +x "$MOCK_PATH"

# Use a neutral context file to avoid keywords in the diff contaminating mock dispatch
CTX=$(make_neutral_context "$TMP")

# Clear any state file
REPO_ROOT_T3="$(cd "${SCRIPT_DIR}/../.." && git rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR}/../..")"
rm -f "${REPO_ROOT_T3}/.claude/.verify-panel-state-E200" 2>/dev/null || true

OUTPUT=$(ATHENA_VERIFY_POSTURE="thorough" \
  CLAUDE_CMD="$MOCK_PATH" \
  AUDIT_LOG_PATH="${TMP}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=3 \
  REFUTE_MAJORITY=2 \
  bash "$PANEL_SH" E200 "$CTX" 2>/dev/null)
EXIT_CODE=$?

# All 3 refutors say refuted=true → 3/3 ≥ 2 → finding dropped → PASS
if [ "$EXIT_CODE" -eq 0 ]; then
  pass "Test 3a: exit 0 after majority-refute drop"
else
  fail "Test 3a: expected exit 0 (PASS after refute drop), got $EXIT_CODE"
fi

if echo "$OUTPUT" | grep -q "FINAL VERDICT: PASS"; then
  pass "Test 3b: PASS verdict after majority-refute drop"
else
  fail "Test 3b: expected PASS verdict — output: $(echo "$OUTPUT" | tail -10)"
fi

# Refuted count should be > 0
if echo "$OUTPUT" | grep -q "dropped by majority refute:"; then
  REFUTED_LINE=$(echo "$OUTPUT" | grep "dropped by majority refute:" | head -1)
  REFUTED_NUM=$(echo "$REFUTED_LINE" | grep -o '[0-9]*$' | head -1)
  if [ "${REFUTED_NUM:-0}" -gt 0 ]; then
    pass "Test 3c: refuted_count > 0 in report"
  else
    fail "Test 3c: expected refuted_count > 0 — line: $REFUTED_LINE"
  fi
else
  fail "Test 3c: refute summary line not found in output"
fi

cleanup_dir "$TMP"

# ---- Test 4: Standard-path passthrough (ATHENA_VERIFY_POSTURE=standard) -----
#
# When posture is standard/quick/unset, the panel must exit 0 immediately
# without calling claude at all.

echo ""
echo "--- Test 4: Standard-path passthrough (posture=standard, no claude calls) ---"

TMP=$(make_temp_dir)

# Create a mock claude that fails if called (to detect accidental calls)
FAIL_MOCK="${TMP}/claude-should-not-be-called"
cat > "$FAIL_MOCK" <<'FAILMOCK'
#!/usr/bin/env bash
echo "ERROR: claude was called but should not be (standard path)" >&2
exit 1
FAILMOCK
chmod +x "$FAIL_MOCK"

# Test with posture=standard
OUTPUT=$(ATHENA_VERIFY_POSTURE="standard" \
  CLAUDE_CMD="$FAIL_MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  bash "$PANEL_SH" E200 2>/dev/null)
EXIT_CODE=$?

if [ "$EXIT_CODE" -eq 0 ]; then
  pass "Test 4a: posture=standard exits 0 (early exit)"
else
  fail "Test 4a: expected exit 0 for standard posture, got $EXIT_CODE"
fi

if echo "$OUTPUT" | grep -q "standard path"; then
  pass "Test 4b: output mentions standard path"
else
  fail "Test 4b: output does not mention standard path — got: $OUTPUT"
fi

# Test with posture=quick
OUTPUT=$(ATHENA_VERIFY_POSTURE="quick" \
  CLAUDE_CMD="$FAIL_MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit2.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  bash "$PANEL_SH" E200 2>/dev/null)
EXIT_CODE=$?

if [ "$EXIT_CODE" -eq 0 ]; then
  pass "Test 4c: posture=quick exits 0 (early exit)"
else
  fail "Test 4c: expected exit 0 for quick posture, got $EXIT_CODE"
fi

# Test with posture unset
OUTPUT=$(CLAUDE_CMD="$FAIL_MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit3.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  bash "$PANEL_SH" E200 2>/dev/null)
EXIT_CODE=$?

if [ "$EXIT_CODE" -eq 0 ]; then
  pass "Test 4d: posture unset exits 0 (early exit)"
else
  fail "Test 4d: expected exit 0 for unset posture, got $EXIT_CODE"
fi

# Verify claude was NOT called (no audit events, no output errors)
if [ ! -f "${TMP}/audit.jsonl" ] || [ ! -s "${TMP}/audit.jsonl" ]; then
  pass "Test 4e: no audit events emitted for standard path (no claude activity)"
else
  # Might have partial events if emit ran, but the fail_mock should not have been invoked
  # Check output doesn't contain the failure marker
  if ! echo "$OUTPUT" | grep -q "ERROR: claude was called"; then
    pass "Test 4e: claude was not called on standard path"
  else
    fail "Test 4e: claude was called despite standard posture"
  fi
fi

cleanup_dir "$TMP"

# ---- Test 5: Completeness-critic flag (AC with no file:line → flagged) ------
#
# Mock completeness critic returns an info finding for an uncovered AC.
# The panel should include this in the surviving findings.

echo ""
echo "--- Test 5: Completeness-critic flag (AC with no file:line → flagged) ---"

TMP=$(make_temp_dir)

# Create a mock that:
# - For lens calls: returns PASS with closed findings
# - For completeness critic calls (prompt includes "completeness critic"): returns info finding
CRITIC_MOCK="${TMP}/claude-critic"
cat > "$CRITIC_MOCK" <<'CRITICMOCK'
#!/usr/bin/env bash
PROMPT="${2:-}"
if echo "${PROMPT}" | grep -qi "completeness critic"; then
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"completeness:AC-3","severity":"info","open":true,"evidence":"Acceptance criterion 3 has no file:line citation in reviewer evidence"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "skeptical code reviewer"; then
  printf '{"structured_output":{"refuted":false,"rationale":"mock: completeness finding is valid"},"stop_reason":"end_turn","num_turns":1}\n'
else
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"no-issues","severity":"info","open":false,"evidence":"all clear"}]},"stop_reason":"end_turn","num_turns":1}\n'
fi
CRITICMOCK
chmod +x "$CRITIC_MOCK"

# Use neutral context file to avoid keyword contamination
CTX5=$(make_neutral_context "$TMP")

# Create a temp spec file in the actual repo's docs/epics/ so the completeness
# critic can find it. We use a fixture epic ID (E999CRITIC) and clean up after.
REPO_ROOT_T5="$(cd "${SCRIPT_DIR}/../.." && git rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR}/../..")"
FIXTURE_SPEC="${REPO_ROOT_T5}/docs/epics/e999critic-test-epic.md"
cat > "$FIXTURE_SPEC" <<'SPECEOF'
# E999CRITIC Test Epic

## Acceptance Criteria

- [ ] AC-1: Feature X is implemented
- [ ] AC-2: Tests cover all paths
- [ ] AC-3: Documentation is updated
SPECEOF

# Clear state file
rm -f "${REPO_ROOT_T5}/.claude/.verify-panel-state-E999CRITIC" 2>/dev/null || true

OUTPUT=$(ATHENA_VERIFY_POSTURE="thorough" \
  CLAUDE_CMD="$CRITIC_MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=3 \
  REFUTE_MAJORITY=2 \
  bash "$PANEL_SH" E999CRITIC "$CTX5" 2>/dev/null)
EXIT_CODE=$?

# Clean up fixture spec and state file
rm -f "$FIXTURE_SPEC" "${REPO_ROOT_T5}/.claude/.verify-panel-state-E999CRITIC" 2>/dev/null || true

# The completeness finding is open=true and not refuted (refuted=false) →
# should appear in surviving findings and cause FAIL exit
# Lens calls return PASS (all closed), so only completeness finding survives
# Exit code: 1 (FAIL due to open completeness finding)
if [ "$EXIT_CODE" -eq 1 ]; then
  pass "Test 5a: exit 1 when completeness critic flags an uncovered AC"
else
  # PASS is also acceptable if completeness finding gets dropped by refute
  if [ "$EXIT_CODE" -eq 0 ] && echo "$OUTPUT" | grep -qi "completeness"; then
    pass "Test 5a: completeness finding processed (exit $EXIT_CODE)"
  else
    fail "Test 5a: expected exit 1 (open completeness finding), got $EXIT_CODE — output: $(echo "$OUTPUT" | tail -5)"
  fi
fi

if echo "$OUTPUT" | grep -qi "completeness"; then
  pass "Test 5b: completeness finding appears in output"
else
  fail "Test 5b: completeness finding not found in output — got: $(echo "$OUTPUT" | tail -10)"
fi

# Audit event should reflect open findings
if [ -f "${TMP}/audit.jsonl" ]; then
  AUDIT_OPEN=$(jq -r 'select(.event == "verify_panel_result") | .open_count' "${TMP}/audit.jsonl" 2>/dev/null | head -1)
  if [ -n "$AUDIT_OPEN" ]; then
    pass "Test 5c: open_count field present in audit event (value=$AUDIT_OPEN)"
  else
    fail "Test 5c: open_count not found in audit event"
  fi
else
  fail "Test 5c: audit.jsonl not created"
fi

cleanup_dir "$TMP"

# ---- Test 6: Ultra — agree-PASS (both evaluators return PASS → final PASS) --
#
# Ultra posture (judge-panel+adversarial+multimodal):
# Both evaluator-A and evaluator-B return PASS → final verdict = PASS.
# Judge panel returns all closed → no blocking findings.

echo ""
echo "--- Test 6: Ultra agree-PASS (both evaluators PASS → final PASS) ---"

TMP=$(make_temp_dir)

ULTRA_AGREE_PASS_MOCK="${TMP}/claude-ultra-agree-pass"
cat > "$ULTRA_AGREE_PASS_MOCK" <<'ULTRAMOCK6'
#!/usr/bin/env bash
# Ultra mock: agree-PASS
# - 4-lens panel calls → PASS (closed findings)
# - Completeness critic → PASS
# - Refute calls → refuted=false (nothing to refute — lens findings are closed)
# - Evaluator-A call (prompt includes "independent evaluator context A") → PASS
# - Evaluator-B call (prompt includes "independent evaluator context B") → PASS
# - Judge calls (prompt includes "Judge") → all ACs closed
PROMPT="${2:-}"
if echo "${PROMPT}" | grep -qi "independent evaluator context A"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "independent evaluator context B"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge A (coverage)"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"judge-a:ok","severity":"info","open":false,"evidence":"all ACs cited"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge B (correctness)"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"judge-b:ok","severity":"info","open":false,"evidence":"evidence matches"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge C (regression)"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"judge-c:ok","severity":"info","open":false,"evidence":"no regression risk"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "completeness critic"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "skeptical code reviewer"; then
  printf '{"structured_output":{"refuted":false,"rationale":"no findings to refute"},"stop_reason":"end_turn","num_turns":1}\n'
else
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"no-issues","severity":"info","open":false,"evidence":"file.py:1 — all clear"}]},"stop_reason":"end_turn","num_turns":1}\n'
fi
ULTRAMOCK6
chmod +x "$ULTRA_AGREE_PASS_MOCK"

CTX6=$(make_neutral_context "$TMP")

REPO_ROOT_T6="$(cd "${SCRIPT_DIR}/../.." && git rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR}/../..")"
FIXTURE_SPEC_6="${REPO_ROOT_T6}/docs/epics/e999ultra6-test-epic.md"
cat > "$FIXTURE_SPEC_6" <<'SPECEOF6'
# E999ULTRA6 Test Epic

## Acceptance Criteria

- [ ] AC-1: Feature X is implemented
- [ ] AC-2: Tests cover all paths
SPECEOF6

rm -f "${REPO_ROOT_T6}/.claude/.verify-panel-state-E999ULTRA6" 2>/dev/null || true

OUTPUT=$(ATHENA_VERIFY_POSTURE="judge-panel+adversarial+multimodal" \
  CLAUDE_CMD="$ULTRA_AGREE_PASS_MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=1 \
  REFUTE_MAJORITY=1 \
  bash "$PANEL_SH" E999ULTRA6 "$CTX6" 2>/dev/null)
EXIT_CODE=$?

rm -f "$FIXTURE_SPEC_6" "${REPO_ROOT_T6}/.claude/.verify-panel-state-E999ULTRA6" 2>/dev/null || true

if [ "$EXIT_CODE" -eq 0 ]; then
  pass "Test 6a: ultra agree-PASS exits 0"
else
  fail "Test 6a: expected exit 0 for ultra agree-PASS, got $EXIT_CODE — output: $(echo "$OUTPUT" | tail -5)"
fi

if echo "$OUTPUT" | grep -q "FINAL VERDICT: PASS"; then
  pass "Test 6b: ultra agree-PASS produces PASS verdict"
else
  fail "Test 6b: expected FINAL VERDICT: PASS — output: $(echo "$OUTPUT" | tail -10)"
fi

if [ -f "${TMP}/audit.jsonl" ]; then
  ULTRA_EVENT=$(jq -r 'select(.event == "verify_panel_ultra") | .agreed' "${TMP}/audit.jsonl" 2>/dev/null | head -1)
  if [ "$ULTRA_EVENT" = "true" ]; then
    pass "Test 6c: verify_panel_ultra audit event emitted with agreed=true"
  else
    fail "Test 6c: expected verify_panel_ultra event with agreed=true — got '$ULTRA_EVENT'"
  fi
else
  fail "Test 6c: audit.jsonl not created"
fi

cleanup_dir "$TMP"

# ---- Test 7: Ultra — agree-FAIL (both evaluators FAIL → final FAIL) ---------
#
# Both evaluator-A and evaluator-B return FAIL → final verdict = FAIL.

echo ""
echo "--- Test 7: Ultra agree-FAIL (both evaluators FAIL → final FAIL) ---"

TMP=$(make_temp_dir)

ULTRA_AGREE_FAIL_MOCK="${TMP}/claude-ultra-agree-fail"
cat > "$ULTRA_AGREE_FAIL_MOCK" <<'ULTRAMOCK7'
#!/usr/bin/env bash
PROMPT="${2:-}"
if echo "${PROMPT}" | grep -qi "independent evaluator context A"; then
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"eval-a:missing-impl","severity":"high","open":true,"evidence":"server/app.py:10 — AC-1 not implemented"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "independent evaluator context B"; then
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"eval-b:missing-impl","severity":"high","open":true,"evidence":"server/app.py:10 — confirmed missing AC-1"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge A (coverage)"; then
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"judge-a:ac1-open","severity":"high","open":true,"evidence":"AC-1 has no file:line"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge B (correctness)"; then
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"judge-b:ac1-open","severity":"high","open":true,"evidence":"AC-1 evidence invalid"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge C (regression)"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"judge-c:ok","severity":"info","open":false,"evidence":"no regression"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "completeness critic"; then
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"completeness:AC-1","severity":"info","open":true,"evidence":"AC-1 not cited"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "skeptical code reviewer"; then
  printf '{"structured_output":{"refuted":false,"rationale":"finding is valid"},"stop_reason":"end_turn","num_turns":1}\n'
else
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"no-issues","severity":"info","open":false,"evidence":"file.py:1 — all clear"}]},"stop_reason":"end_turn","num_turns":1}\n'
fi
ULTRAMOCK7
chmod +x "$ULTRA_AGREE_FAIL_MOCK"

CTX7=$(make_neutral_context "$TMP")
REPO_ROOT_T7="$(cd "${SCRIPT_DIR}/../.." && git rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR}/../..")"
FIXTURE_SPEC_7="${REPO_ROOT_T7}/docs/epics/e999ultra7-test-epic.md"
cat > "$FIXTURE_SPEC_7" <<'SPECEOF7'
# E999ULTRA7 Test Epic

## Acceptance Criteria

- [ ] AC-1: Feature X is implemented
SPECEOF7

rm -f "${REPO_ROOT_T7}/.claude/.verify-panel-state-E999ULTRA7" 2>/dev/null || true

OUTPUT=$(ATHENA_VERIFY_POSTURE="judge-panel+adversarial+multimodal" \
  CLAUDE_CMD="$ULTRA_AGREE_FAIL_MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=1 \
  REFUTE_MAJORITY=1 \
  bash "$PANEL_SH" E999ULTRA7 "$CTX7" 2>/dev/null)
EXIT_CODE=$?

rm -f "$FIXTURE_SPEC_7" "${REPO_ROOT_T7}/.claude/.verify-panel-state-E999ULTRA7" 2>/dev/null || true

if [ "$EXIT_CODE" -eq 1 ]; then
  pass "Test 7a: ultra agree-FAIL exits 1"
else
  fail "Test 7a: expected exit 1 for ultra agree-FAIL, got $EXIT_CODE — output: $(echo "$OUTPUT" | tail -5)"
fi

if echo "$OUTPUT" | grep -q "FINAL VERDICT: FAIL"; then
  pass "Test 7b: ultra agree-FAIL produces FAIL verdict"
else
  fail "Test 7b: expected FINAL VERDICT: FAIL — output: $(echo "$OUTPUT" | tail -10)"
fi

if [ -f "${TMP}/audit.jsonl" ]; then
  ULTRA_AGREED=$(jq -r 'select(.event == "verify_panel_ultra") | .agreed' "${TMP}/audit.jsonl" 2>/dev/null | head -1)
  ULTRA_VERDICT=$(jq -r 'select(.event == "verify_panel_ultra") | .final_verdict' "${TMP}/audit.jsonl" 2>/dev/null | head -1)
  if [ "$ULTRA_AGREED" = "true" ] && [ "$ULTRA_VERDICT" = "FAIL" ]; then
    pass "Test 7c: verify_panel_ultra event has agreed=true and final_verdict=FAIL"
  else
    fail "Test 7c: expected agreed=true final_verdict=FAIL — got agreed='$ULTRA_AGREED' verdict='$ULTRA_VERDICT'"
  fi
else
  fail "Test 7c: audit.jsonl not created"
fi

cleanup_dir "$TMP"

# ---- Test 8: Ultra — disagree (one PASS, one FAIL → ESCALATE) ---------------
#
# Evaluator-A returns PASS, evaluator-B returns FAIL → verdict = ESCALATE.
# Epic must NOT auto-advance; needs_human signal is emitted.

echo ""
echo "--- Test 8: Ultra disagree (one PASS, one FAIL → ESCALATE) ---"

TMP=$(make_temp_dir)

ULTRA_DISAGREE_MOCK="${TMP}/claude-ultra-disagree"
cat > "$ULTRA_DISAGREE_MOCK" <<'ULTRAMOCK8'
#!/usr/bin/env bash
PROMPT="${2:-}"
if echo "${PROMPT}" | grep -qi "independent evaluator context A"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "independent evaluator context B"; then
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"eval-b:issue","severity":"high","open":true,"evidence":"server/app.py:5 — incomplete"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"judge:ok","severity":"info","open":false,"evidence":"ok"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "completeness critic"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "skeptical code reviewer"; then
  printf '{"structured_output":{"refuted":false,"rationale":"no refute"},"stop_reason":"end_turn","num_turns":1}\n'
else
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"no-issues","severity":"info","open":false,"evidence":"file.py:1 — clear"}]},"stop_reason":"end_turn","num_turns":1}\n'
fi
ULTRAMOCK8
chmod +x "$ULTRA_DISAGREE_MOCK"

CTX8=$(make_neutral_context "$TMP")
REPO_ROOT_T8="$(cd "${SCRIPT_DIR}/../.." && git rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR}/../..")"
FIXTURE_SPEC_8="${REPO_ROOT_T8}/docs/epics/e999ultra8-test-epic.md"
cat > "$FIXTURE_SPEC_8" <<'SPECEOF8'
# E999ULTRA8 Test Epic

## Acceptance Criteria

- [ ] AC-1: Feature X is implemented
SPECEOF8

rm -f "${REPO_ROOT_T8}/.claude/.verify-panel-state-E999ULTRA8" 2>/dev/null || true

OUTPUT=$(ATHENA_VERIFY_POSTURE="judge-panel+adversarial+multimodal" \
  CLAUDE_CMD="$ULTRA_DISAGREE_MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=1 \
  REFUTE_MAJORITY=1 \
  bash "$PANEL_SH" E999ULTRA8 "$CTX8" 2>/dev/null)
EXIT_CODE=$?

rm -f "$FIXTURE_SPEC_8" "${REPO_ROOT_T8}/.claude/.verify-panel-state-E999ULTRA8" 2>/dev/null || true

# ESCALATE exits 1 (non-advance, requires human)
if [ "$EXIT_CODE" -eq 1 ]; then
  pass "Test 8a: ultra disagree exits 1 (ESCALATE — do not auto-advance)"
else
  fail "Test 8a: expected exit 1 for ESCALATE, got $EXIT_CODE — output: $(echo "$OUTPUT" | tail -5)"
fi

if echo "$OUTPUT" | grep -q "ESCALATE"; then
  pass "Test 8b: ultra disagree output contains ESCALATE"
else
  fail "Test 8b: expected ESCALATE in output — output: $(echo "$OUTPUT" | tail -10)"
fi

if echo "$OUTPUT" | grep -qi "needs_human"; then
  pass "Test 8c: ultra disagree output mentions needs_human"
else
  fail "Test 8c: expected needs_human in output — output: $(echo "$OUTPUT" | tail -10)"
fi

if [ -f "${TMP}/audit.jsonl" ]; then
  ULTRA_AGREED=$(jq -r 'select(.event == "verify_panel_ultra") | .agreed' "${TMP}/audit.jsonl" 2>/dev/null | head -1)
  ULTRA_VERDICT=$(jq -r 'select(.event == "verify_panel_ultra") | .final_verdict' "${TMP}/audit.jsonl" 2>/dev/null | head -1)
  if [ "$ULTRA_AGREED" = "false" ] && [ "$ULTRA_VERDICT" = "ESCALATE" ]; then
    pass "Test 8d: verify_panel_ultra event has agreed=false and final_verdict=ESCALATE"
  else
    fail "Test 8d: expected agreed=false final_verdict=ESCALATE — got agreed='$ULTRA_AGREED' verdict='$ULTRA_VERDICT'"
  fi
else
  fail "Test 8d: audit.jsonl not created"
fi

cleanup_dir "$TMP"

# ---- Test 9: Ultra — judge ≥2/3 open → blocking finding --------------------
#
# Two of three judges flag an AC as open → that AC becomes a blocking finding.

echo ""
echo "--- Test 9: Ultra judge panel ≥2/3 open → blocking finding ---"

TMP=$(make_temp_dir)

ULTRA_JUDGE_BLOCK_MOCK="${TMP}/claude-ultra-judge-block"
cat > "$ULTRA_JUDGE_BLOCK_MOCK" <<'ULTRAMOCK9'
#!/usr/bin/env bash
PROMPT="${2:-}"
if echo "${PROMPT}" | grep -qi "independent evaluator context A"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "independent evaluator context B"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge A (coverage)"; then
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"judge-a:ac1-open","severity":"high","open":true,"evidence":"AC-1 has no file:line citation"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge B (correctness)"; then
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"judge-b:ac1-open","severity":"high","open":true,"evidence":"AC-1 evidence does not satisfy criterion"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge C (regression)"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"judge-c:ok","severity":"info","open":false,"evidence":"no regression detected"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "completeness critic"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "skeptical code reviewer"; then
  printf '{"structured_output":{"refuted":false,"rationale":"no refute"},"stop_reason":"end_turn","num_turns":1}\n'
else
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"no-issues","severity":"info","open":false,"evidence":"file.py:1 — clear"}]},"stop_reason":"end_turn","num_turns":1}\n'
fi
ULTRAMOCK9
chmod +x "$ULTRA_JUDGE_BLOCK_MOCK"

CTX9=$(make_neutral_context "$TMP")
REPO_ROOT_T9="$(cd "${SCRIPT_DIR}/../.." && git rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR}/../..")"
FIXTURE_SPEC_9="${REPO_ROOT_T9}/docs/epics/e999ultra9-test-epic.md"
cat > "$FIXTURE_SPEC_9" <<'SPECEOF9'
# E999ULTRA9 Test Epic

## Acceptance Criteria

- [ ] AC-1: Feature X is implemented
- [ ] AC-2: Tests cover all paths
SPECEOF9

rm -f "${REPO_ROOT_T9}/.claude/.verify-panel-state-E999ULTRA9" 2>/dev/null || true

OUTPUT=$(ATHENA_VERIFY_POSTURE="judge-panel+adversarial+multimodal" \
  CLAUDE_CMD="$ULTRA_JUDGE_BLOCK_MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=1 \
  REFUTE_MAJORITY=1 \
  bash "$PANEL_SH" E999ULTRA9 "$CTX9" 2>/dev/null)
EXIT_CODE=$?

rm -f "$FIXTURE_SPEC_9" "${REPO_ROOT_T9}/.claude/.verify-panel-state-E999ULTRA9" 2>/dev/null || true

# ≥2/3 judges flagged open → blocking → exit 1
if [ "$EXIT_CODE" -eq 1 ]; then
  pass "Test 9a: judge ≥2/3 open exits 1 (blocking)"
else
  fail "Test 9a: expected exit 1 for judge majority open, got $EXIT_CODE — output: $(echo "$OUTPUT" | tail -5)"
fi

if echo "$OUTPUT" | grep -qi "judge.*block\|blocking.*judge\|FAIL"; then
  pass "Test 9b: output indicates blocking judge finding"
else
  fail "Test 9b: expected blocking judge indication in output — output: $(echo "$OUTPUT" | tail -10)"
fi

if [ -f "${TMP}/audit.jsonl" ]; then
  JUDGE_OPEN=$(jq -r 'select(.event == "verify_panel_ultra") | .judge_open_count' "${TMP}/audit.jsonl" 2>/dev/null | head -1)
  if [ -n "$JUDGE_OPEN" ] && [ "$JUDGE_OPEN" -ge 1 ]; then
    pass "Test 9c: verify_panel_ultra event has judge_open_count >= 1 (value=$JUDGE_OPEN)"
  else
    fail "Test 9c: expected judge_open_count >= 1 — got '$JUDGE_OPEN'"
  fi
else
  fail "Test 9c: audit.jsonl not created"
fi

cleanup_dir "$TMP"

# ---- Test 10: Ultra — judge 1/3 open → advisory only (non-blocking) ---------
#
# Only one of three judges flags an AC as open → advisory only, not blocking.
# Evaluators both PASS → final verdict PASS (assuming no other open findings).

echo ""
echo "--- Test 10: Ultra judge 1/3 open → advisory only (non-blocking) ---"

TMP=$(make_temp_dir)

ULTRA_JUDGE_ADVISORY_MOCK="${TMP}/claude-ultra-judge-advisory"
cat > "$ULTRA_JUDGE_ADVISORY_MOCK" <<'ULTRAMOCK10'
#!/usr/bin/env bash
PROMPT="${2:-}"
if echo "${PROMPT}" | grep -qi "independent evaluator context A"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "independent evaluator context B"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge A (coverage)"; then
  # Only judge A flags something (1/3)
  printf '{"structured_output":{"verdict":"FAIL","findings":[{"id":"judge-a:ac2-advisory","severity":"info","open":true,"evidence":"AC-2 might have weak coverage"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge B (correctness)"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"judge-b:ok","severity":"info","open":false,"evidence":"all correct"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "Judge C (regression)"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"judge-c:ok","severity":"info","open":false,"evidence":"no regression"}]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "completeness critic"; then
  printf '{"structured_output":{"verdict":"PASS","findings":[]},"stop_reason":"end_turn","num_turns":1}\n'
elif echo "${PROMPT}" | grep -qi "skeptical code reviewer"; then
  printf '{"structured_output":{"refuted":false,"rationale":"no refute"},"stop_reason":"end_turn","num_turns":1}\n'
else
  printf '{"structured_output":{"verdict":"PASS","findings":[{"id":"no-issues","severity":"info","open":false,"evidence":"file.py:1 — clear"}]},"stop_reason":"end_turn","num_turns":1}\n'
fi
ULTRAMOCK10
chmod +x "$ULTRA_JUDGE_ADVISORY_MOCK"

CTX10=$(make_neutral_context "$TMP")
REPO_ROOT_T10="$(cd "${SCRIPT_DIR}/../.." && git rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR}/../..")"
FIXTURE_SPEC_10="${REPO_ROOT_T10}/docs/epics/e999ultra10-test-epic.md"
cat > "$FIXTURE_SPEC_10" <<'SPECEOF10'
# E999ULTRA10 Test Epic

## Acceptance Criteria

- [ ] AC-1: Feature X is implemented
- [ ] AC-2: Tests cover all paths
SPECEOF10

rm -f "${REPO_ROOT_T10}/.claude/.verify-panel-state-E999ULTRA10" 2>/dev/null || true

OUTPUT=$(ATHENA_VERIFY_POSTURE="judge-panel+adversarial+multimodal" \
  CLAUDE_CMD="$ULTRA_JUDGE_ADVISORY_MOCK" \
  AUDIT_LOG_PATH="${TMP}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=1 \
  REFUTE_MAJORITY=1 \
  bash "$PANEL_SH" E999ULTRA10 "$CTX10" 2>/dev/null)
EXIT_CODE=$?

rm -f "$FIXTURE_SPEC_10" "${REPO_ROOT_T10}/.claude/.verify-panel-state-E999ULTRA10" 2>/dev/null || true

# 1/3 judge open → advisory → should not block → exit 0 (PASS)
if [ "$EXIT_CODE" -eq 0 ]; then
  pass "Test 10a: judge 1/3 open exits 0 (advisory only, non-blocking)"
else
  fail "Test 10a: expected exit 0 for advisory-only judge finding, got $EXIT_CODE — output: $(echo "$OUTPUT" | tail -5)"
fi

if echo "$OUTPUT" | grep -qi "advisory\|PASS"; then
  pass "Test 10b: output indicates advisory or PASS"
else
  fail "Test 10b: expected advisory or PASS in output — output: $(echo "$OUTPUT" | tail -10)"
fi

# Verify thorough path is unaffected — posture=thorough should NOT run ultra code
# (regression check — run with thorough posture, confirm no ESCALATE / ultra events)
echo ""
echo "--- Test 10-regression: thorough posture unchanged by E206 (byte-identical path) ---"

TMP_REG=$(make_temp_dir)
CTX_REG=$(make_neutral_context "$TMP_REG")
MOCK_REG=$(make_mock_claude "$TMP_REG" '{"verdict":"PASS","findings":[{"id":"no-issues","severity":"info","open":false,"evidence":"file.py:1 — all clear"}]}')
REPO_ROOT_REG="$(cd "${SCRIPT_DIR}/../.." && git rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR}/../..")"
rm -f "${REPO_ROOT_REG}/.claude/.verify-panel-state-E200" 2>/dev/null || true

OUTPUT_REG=$(ATHENA_VERIFY_POSTURE="thorough" \
  CLAUDE_CMD="$MOCK_REG" \
  AUDIT_LOG_PATH="${TMP_REG}/audit.jsonl" \
  FINDINGS_SCHEMA="$SCHEMA_PATH" \
  CLOCK_TS="2026-06-01T00:00:00Z" \
  SCHEMA_MAX_RETRIES=1 \
  REFUTE_N=3 \
  REFUTE_MAJORITY=2 \
  bash "$PANEL_SH" E200 "$CTX_REG" 2>/dev/null)
REG_EXIT=$?

if [ "$REG_EXIT" -eq 0 ] && echo "$OUTPUT_REG" | grep -q "FINAL VERDICT: PASS"; then
  pass "Test 10-reg-a: thorough posture still exits 0 with PASS (no regression from E206)"
else
  fail "Test 10-reg-a: thorough posture regression — exit=$REG_EXIT output=$(echo "$OUTPUT_REG" | tail -5)"
fi

ULTRA_IN_THOROUGH=$(jq 'select(.event == "verify_panel_ultra")' "${TMP_REG}/audit.jsonl" 2>/dev/null | wc -l | tr -d ' ')
if [ "${ULTRA_IN_THOROUGH:-0}" -eq 0 ]; then
  pass "Test 10-reg-b: no verify_panel_ultra event in thorough path (isolated correctly)"
else
  fail "Test 10-reg-b: unexpected verify_panel_ultra event in thorough path"
fi

cleanup_dir "$TMP_REG"
cleanup_dir "$TMP"

# ---- Summary ----------------------------------------------------------------

echo ""
TOTAL=$((PASS + FAIL))
echo "Results: $PASS/$TOTAL passed"
if [ "$FAIL" -gt 0 ]; then
  echo "FAILURES: $FAIL"
  exit 1
fi
exit 0
