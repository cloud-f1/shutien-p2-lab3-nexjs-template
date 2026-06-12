#!/usr/bin/env bash
# scripts/batch-tests/test-e201-schemas.sh — E201 schema validation test
#
# Validates that .claude/commands/athena/batch.md contains all required
# E201 additions: agent report schema, probe schema, resolve.sh reference,
# posture branch section with standard and parallel.
#
# Usage:
#   bash scripts/batch-tests/test-e201-schemas.sh
#
# Exit code: 0 = all pass, 1 = one or more failures
# Runtime: <2s

set -uo pipefail

BATCH_MD=".claude/commands/athena/batch.md"
PASS=0
FAIL=0
RESULTS=()

pass() {
  local name="$1"
  PASS=$(( PASS + 1 ))
  RESULTS+=("  PASS: $name")
}

fail() {
  local name="$1"
  local detail="${2:-}"
  FAIL=$(( FAIL + 1 ))
  if [ -n "$detail" ]; then
    RESULTS+=("  FAIL: $name — $detail")
  else
    RESULTS+=("  FAIL: $name")
  fi
}

# Resolve repo root (script may be run from any directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BATCH_MD_PATH="$REPO_ROOT/$BATCH_MD"

if [ ! -f "$BATCH_MD_PATH" ]; then
  echo "ERROR: $BATCH_MD_PATH not found"
  exit 1
fi

# ---------------------------------------------------------------------------
# Test 1: Agent Report Schema fenced block exists
# ---------------------------------------------------------------------------
if grep -q '## Agent Report Schema' "$BATCH_MD_PATH"; then
  pass "Agent Report Schema section exists"
else
  fail "Agent Report Schema section exists" "missing '## Agent Report Schema' heading"
fi

# ---------------------------------------------------------------------------
# Test 2: Report schema has all 5 required fields
# ---------------------------------------------------------------------------
MISSING_FIELDS=""
for field in '"status"' '"filesChanged"' '"worktreePath"' '"worktreeBranch"' '"summary"'; do
  if ! grep -q "$field" "$BATCH_MD_PATH"; then
    MISSING_FIELDS="$MISSING_FIELDS $field"
  fi
done
if [ -z "$MISSING_FIELDS" ]; then
  pass "Agent Report Schema has all 5 required fields"
else
  fail "Agent Report Schema has all 5 required fields" "missing:$MISSING_FIELDS"
fi

# ---------------------------------------------------------------------------
# Test 3: Status enum values documented (success | failure | blocked)
# ---------------------------------------------------------------------------
if grep -q '"success"' "$BATCH_MD_PATH" && grep -q '"failure"' "$BATCH_MD_PATH" && grep -q '"blocked"' "$BATCH_MD_PATH"; then
  pass "Agent Report Schema status enum has success/failure/blocked"
else
  fail "Agent Report Schema status enum has success/failure/blocked" "one or more enum values missing"
fi

# ---------------------------------------------------------------------------
# Test 4: Step 3.5 Probe Schema fenced block exists
# ---------------------------------------------------------------------------
if grep -q '## Step 3.5 Probe Schema' "$BATCH_MD_PATH"; then
  pass "Step 3.5 Probe Schema section exists"
else
  fail "Step 3.5 Probe Schema section exists" "missing '## Step 3.5 Probe Schema' heading"
fi

# ---------------------------------------------------------------------------
# Test 5: Probe schema has isolationVerdict field
# ---------------------------------------------------------------------------
if grep -q '"isolationVerdict"' "$BATCH_MD_PATH"; then
  pass "Probe Schema has isolationVerdict field"
else
  fail "Probe Schema has isolationVerdict field" "missing '\"isolationVerdict\"' in batch.md"
fi

# ---------------------------------------------------------------------------
# Test 6: Probe schema verdict enum is typed (ISOLATED | SHARED)
# ---------------------------------------------------------------------------
if grep -q 'ISOLATED' "$BATCH_MD_PATH" && grep -q 'SHARED' "$BATCH_MD_PATH"; then
  pass "Probe Schema isolationVerdict enum has ISOLATED and SHARED"
else
  fail "Probe Schema isolationVerdict enum has ISOLATED and SHARED" "one or more enum values missing"
fi

# ---------------------------------------------------------------------------
# Test 7: Substring match on freeform text is eliminated
# ---------------------------------------------------------------------------
if grep -q 'ISOLATION_VERDICT.*SHARED.*in probe.body' "$BATCH_MD_PATH"; then
  fail "Old substring match removed" "still contains 'ISOLATION_VERDICT: SHARED' in probe.body substring check"
else
  pass "Old substring match removed (no freeform text matching)"
fi

# ---------------------------------------------------------------------------
# Test 8: --max-concurrent description mentions resolve.sh
# ---------------------------------------------------------------------------
if grep -q 'resolve.sh' "$BATCH_MD_PATH" && grep -q 'MAX_CONCURRENT' "$BATCH_MD_PATH"; then
  pass "--max-concurrent description mentions resolve.sh and MAX_CONCURRENT"
else
  fail "--max-concurrent description mentions resolve.sh and MAX_CONCURRENT" "missing reference to resolve.sh or MAX_CONCURRENT"
fi

# ---------------------------------------------------------------------------
# Test 9: Posture branch section exists
# ---------------------------------------------------------------------------
if grep -q 'Dispatch Posture' "$BATCH_MD_PATH"; then
  pass "Dispatch Posture section exists"
else
  fail "Dispatch Posture section exists" "missing 'Dispatch Posture' section"
fi

# ---------------------------------------------------------------------------
# Test 10: Both standard and parallel postures are mentioned
# ---------------------------------------------------------------------------
if grep -q 'standard' "$BATCH_MD_PATH" && grep -q 'parallel' "$BATCH_MD_PATH"; then
  pass "Posture branch section mentions both standard and parallel"
else
  fail "Posture branch section mentions both standard and parallel" "one or both postures missing"
fi

# ---------------------------------------------------------------------------
# Test 11: pipeline() per-epic dispatch pattern documented
# ---------------------------------------------------------------------------
if grep -q 'pipeline(E)' "$BATCH_MD_PATH" || grep -q 'pipeline(epic' "$BATCH_MD_PATH" || grep -q 'pipeline()' "$BATCH_MD_PATH"; then
  pass "pipeline() per-epic dispatch pattern documented"
else
  fail "pipeline() per-epic dispatch pattern documented" "missing pipeline() pattern in batch.md"
fi

# ---------------------------------------------------------------------------
# Test 12: parallel() reserved only for integration gate
# ---------------------------------------------------------------------------
if grep -q "parallel().*integration\|integration.*parallel()" "$BATCH_MD_PATH"; then
  pass "parallel() correctly scoped to integration gate"
else
  fail "parallel() correctly scoped to integration gate" "no mention of parallel() + integration gate pairing"
fi

# ---------------------------------------------------------------------------
# Test 13: Step 3.5b probe uses JSON schema (not freeform)
# ---------------------------------------------------------------------------
if grep -q '"isolationVerdict".*ISOLATED.*SHARED\|ISOLATED.*SHARED.*isolationVerdict' "$BATCH_MD_PATH"; then
  pass "Step 3.5b probe uses JSON schema for verdict"
else
  # Check for multiline pattern (field on its own line)
  if grep -A2 '"isolationVerdict"' "$BATCH_MD_PATH" | grep -q 'ISOLATED\|SHARED'; then
    pass "Step 3.5b probe uses JSON schema for verdict"
  else
    fail "Step 3.5b probe uses JSON schema for verdict" "probe schema isolationVerdict field not connected to ISOLATED|SHARED"
  fi
fi

# ---------------------------------------------------------------------------
# Test 14: Decision rule checks probe_result.isolationVerdict (not substring)
# ---------------------------------------------------------------------------
if grep -q 'probe_result.isolationVerdict\|probe\.isolationVerdict' "$BATCH_MD_PATH"; then
  pass "Decision rule checks probe_result.isolationVerdict field"
else
  fail "Decision rule checks probe_result.isolationVerdict field" "no 'probe_result.isolationVerdict' or 'probe.isolationVerdict' in batch.md"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
TOTAL=$(( PASS + FAIL ))
echo "E201 Schema Validation — batch.md"
echo "==================================="
for result in "${RESULTS[@]}"; do
  echo "$result"
done
echo ""
echo "Results: $PASS/$TOTAL passed"

if [ "$FAIL" -gt 0 ]; then
  echo "Status: FAIL ($FAIL failures)"
  exit 1
else
  echo "Status: PASS"
  exit 0
fi
