#!/usr/bin/env bash
# test-brainstorm-emit.sh — fixture-driven tests for brainstorm-emit.sh

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HARNESS="$SCRIPT_DIR/../brainstorm-emit.sh"
FIXTURES="$SCRIPT_DIR/fixtures"
GOLDEN="$SCRIPT_DIR/golden"

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1" >&2; FAIL=$((FAIL+1)); }

# --- Test 1: usage error when called with no args ---
echo "Test 1: no-args usage error"
if "$HARNESS" 2>/dev/null; then
  fail "expected exit 64, got 0"
else
  rc=$?
  [ "$rc" -eq 64 ] && pass "exit 64 on missing args" || fail "expected exit 64, got $rc"
fi

# --- Test 2: strategy-log appends golden row ---
echo "Test 2: strategy-log golden output"
TMPDIR_T2=$(mktemp -d)
cp "$FIXTURES/sample-brainstorm.json" "$TMPDIR_T2/input.json"

# Seed a minimal strategy-log
cat > "$TMPDIR_T2/strategy-log.md" <<EOF
# Strategy Log

## Current Cycle

EOF

STRATEGY_LOG_PATH="$TMPDIR_T2/strategy-log.md" \
  CLOCK_DATE="2026-05-19" \
  AUDIT_LOG_PATH="$TMPDIR_T2/audit.jsonl" \
  "$HARNESS" strategy-log "$TMPDIR_T2/input.json" 2>&1

# Compare the appended block to the golden
# The seed file is 4 lines; the harness prepends an extra blank line when appending → skip 5 lines total
ACTUAL=$(tail -n +6 "$TMPDIR_T2/strategy-log.md")  # skip "# Strategy Log\n\n## Current Cycle\n\n\n"
EXPECTED=$(cat "$GOLDEN/expected-strategy-log-row.md")

if [ "$ACTUAL" = "$EXPECTED" ]; then
  pass "strategy-log matches golden"
else
  fail "strategy-log diverged from golden"
  diff <(echo "$EXPECTED") <(echo "$ACTUAL") | head -30
fi

rm -rf "$TMPDIR_T2"

# --- Test 3: render-epic writes golden epic file ---
echo "Test 3: render-epic golden output"
TMPDIR_T3=$(mktemp -d)
mkdir -p "$TMPDIR_T3/epics"
cp "$FIXTURES/sample-brainstorm.json" "$TMPDIR_T3/input.json"

EPICS_DIR="$TMPDIR_T3/epics" \
  AUDIT_LOG_PATH="$TMPDIR_T3/audit.jsonl" \
  "$HARNESS" render-epic "$TMPDIR_T3/input.json" 2>&1

ACTUAL_FILE="$TMPDIR_T3/epics/e300-weekly-digest-emails.md"
if [ ! -f "$ACTUAL_FILE" ]; then
  fail "epic file not created: $ACTUAL_FILE"
else
  if diff -q "$ACTUAL_FILE" "$GOLDEN/expected-epic-file.md" >/dev/null; then
    pass "epic file matches golden"
  else
    fail "epic file diverged from golden"
    diff "$GOLDEN/expected-epic-file.md" "$ACTUAL_FILE" | head -40
  fi
fi

rm -rf "$TMPDIR_T3"

# --- Test 4: plan_brainstorm audit event emitted ---
echo "Test 4: audit event emission"
TMPDIR_T4=$(mktemp -d)
mkdir -p "$TMPDIR_T4/epics"
cp "$FIXTURES/sample-brainstorm.json" "$TMPDIR_T4/input.json"
cat > "$TMPDIR_T4/strategy-log.md" <<EOF
# Strategy Log
EOF

AUDIT_LOG_PATH="$TMPDIR_T4/audit.jsonl" \
  STRATEGY_LOG_PATH="$TMPDIR_T4/strategy-log.md" \
  EPICS_DIR="$TMPDIR_T4/epics" \
  CLOCK_TS="2026-05-19T12:00:00Z" \
  "$HARNESS" strategy-log "$TMPDIR_T4/input.json" >/dev/null

AUDIT_LOG_PATH="$TMPDIR_T4/audit.jsonl" \
  EPICS_DIR="$TMPDIR_T4/epics" \
  CLOCK_TS="2026-05-19T12:00:01Z" \
  "$HARNESS" render-epic "$TMPDIR_T4/input.json" >/dev/null

# Expect exactly 2 plan_brainstorm events: one proposed, one approved
PROPOSED=$(grep -c '"status":"proposed"' "$TMPDIR_T4/audit.jsonl" || echo 0)
APPROVED=$(grep -c '"status":"approved"' "$TMPDIR_T4/audit.jsonl" || echo 0)
EVENT_COUNT=$(grep -c '"event":"plan_brainstorm"' "$TMPDIR_T4/audit.jsonl" || echo 0)

if [ "$EVENT_COUNT" -eq 2 ] && [ "$PROPOSED" -eq 1 ] && [ "$APPROVED" -eq 1 ]; then
  pass "audit emits 1 proposed + 1 approved"
else
  fail "audit count wrong (proposed=$PROPOSED, approved=$APPROVED, total=$EVENT_COUNT)"
fi

# Schema check: phase_count is int 3 (from fixture), epic is E300
SCHEMA_OK=$(jq -s 'all(.[]; .event=="plan_brainstorm" and .epic=="E300" and .phase_count==3)' "$TMPDIR_T4/audit.jsonl")
[ "$SCHEMA_OK" = "true" ] && pass "audit schema fields correct" || fail "audit schema mismatch"

rm -rf "$TMPDIR_T4"

# --- Test 5: missing required field rejects ---
echo "Test 5: missing field rejection"
TMPDIR_T5=$(mktemp -d)
cat > "$TMPDIR_T5/bad.json" <<EOF
{"slug": "broken", "name": "Missing epic field"}
EOF
mkdir -p "$TMPDIR_T5/epics"

if EPICS_DIR="$TMPDIR_T5/epics" "$HARNESS" render-epic "$TMPDIR_T5/bad.json" 2>/dev/null; then
  fail "expected non-zero exit on missing field, got 0"
else
  pass "harness rejects malformed JSON"
fi

rm -rf "$TMPDIR_T5"

# --- Test 6: render-epic refuses overwrite ---
echo "Test 6: idempotency guard"
TMPDIR_T6=$(mktemp -d)
mkdir -p "$TMPDIR_T6/epics"
cp "$FIXTURES/sample-brainstorm.json" "$TMPDIR_T6/input.json"

# First render — should succeed
EPICS_DIR="$TMPDIR_T6/epics" AUDIT_LOG_PATH="$TMPDIR_T6/audit.jsonl" "$HARNESS" render-epic "$TMPDIR_T6/input.json" >/dev/null

# Second render — should fail with exit 68
if EPICS_DIR="$TMPDIR_T6/epics" AUDIT_LOG_PATH="$TMPDIR_T6/audit.jsonl" "$HARNESS" render-epic "$TMPDIR_T6/input.json" 2>/dev/null; then
  fail "expected exit 68 on existing file, got 0"
else
  rc=$?
  [ "$rc" -eq 68 ] && pass "harness refuses overwrite" || fail "expected exit 68, got $rc"
fi

rm -rf "$TMPDIR_T6"

# --- Test 7: existing epic files have required core sections ---
echo "Test 7: existing epic files backward-compat"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
EXISTING_EPICS=("e180-memory-retrieval-logging.md" "e186-memory-metrics-dashboard.md")
BACKCOMPAT_OK=1
for ep in "${EXISTING_EPICS[@]}"; do
  if [ ! -f "$REPO_ROOT/docs/epics/$ep" ]; then
    fail "existing epic missing: $ep"
    BACKCOMPAT_OK=0
    continue
  fi
  if ! grep -q "^## Problem" "$REPO_ROOT/docs/epics/$ep"; then
    fail "epic $ep missing ## Problem section"
    BACKCOMPAT_OK=0
  fi
  if ! grep -q "^## Acceptance Criteria" "$REPO_ROOT/docs/epics/$ep"; then
    fail "epic $ep missing ## Acceptance Criteria section"
    BACKCOMPAT_OK=0
  fi
done
[ "$BACKCOMPAT_OK" -eq 1 ] && pass "existing epics retain core sections"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
