#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# test-check-drift.sh — fixture-driven tests for check-drift.sh
#
# Seeds a deliberate mismatch between epic-progress.md and EPIC_INDEX.md,
# asserts check-drift.sh exits non-zero and emits a state_drift JSONL event.
# Also tests the clean (no drift) case exits 0.
#
# Exit 0 = all pass; exit 1 = at least one failure.
# -----------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$SCRIPT_DIR/../check-drift.sh"

if [ ! -x "$CHECK" ]; then
  echo "FAIL: check-drift.sh not executable at $CHECK" >&2
  exit 1
fi

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() {
  echo "FAIL: $1"
  echo "  detail: $2"
  FAIL=$((FAIL + 1))
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Build a canonical epic-progress.md fixture
PROGRESS="$TMP/epic-progress.md"
cat > "$PROGRESS" << 'EOF'
# AI-Coding-Template — Epic Progress Tracker

## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1, E2 | ✅ Complete |
| Phase 2 | E3 | ⬜ Pending |

## Epic Step Matrix

| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E1 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — DONE |
| E2 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 1 — DONE |
| E3 | ✅ | 🔄 | ⬜ | ⬜ | ⬜ | Phase 2 — in-progress |
EOF

# -----------------------------------------------------------------------
# TEST SCENARIO A: Deliberate mismatch — INDEX says Phase 1 is 🔄 In-Progress
# but epic-progress says ✅ Complete
# -----------------------------------------------------------------------
INDEX_MISMATCH="$TMP/EPIC_INDEX_mismatch.md"
AUDIT_LOG="$TMP/audit.jsonl"

cat > "$INDEX_MISMATCH" << 'EOF'
# EPIC_INDEX

<!-- PHASE_STATUS_START -->
| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1, E2 | 🔄 In-Progress |
| Phase 2 | E3 | ⬜ Pending |
<!-- PHASE_STATUS_END -->

<!-- EPIC_MATRIX_START -->
| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | stale |
| E2 | ✅ | ✅ | ⏭️ | ✅ | ✅ | ok |
| E3 | ✅ | 🔄 | ⬜ | ⬜ | ⬜ | ok |
<!-- EPIC_MATRIX_END -->
EOF

# --- TEST 1: exits non-zero on mismatch ---
set +e
AUDIT_LOG="$AUDIT_LOG" PROGRESS_FILE="$PROGRESS" INDEX_FILE="$INDEX_MISMATCH" \
  bash "$CHECK" 2>/dev/null
EXIT_CODE=$?
set -e

if [ "$EXIT_CODE" -ne 0 ]; then
  pass "check-drift.sh exits non-zero when mismatch exists"
else
  fail "check-drift.sh exits non-zero when mismatch exists" "exit code: $EXIT_CODE (expected != 0)"
fi

# --- TEST 2: emits state_drift event to audit log ---
if [ -f "$AUDIT_LOG" ] && grep -q '"event":"state_drift"' "$AUDIT_LOG"; then
  pass "state_drift event emitted to audit log"
else
  fail "state_drift event emitted to audit log" "audit.jsonl missing or no state_drift event"
fi

# --- TEST 3: audit event has correct schema fields ---
if [ -f "$AUDIT_LOG" ]; then
  if grep '"event":"state_drift"' "$AUDIT_LOG" | grep -q '"source":"check-drift.sh"'; then
    pass "state_drift event has source field"
  else
    fail "state_drift event has source field" "$(cat "$AUDIT_LOG")"
  fi

  if grep '"event":"state_drift"' "$AUDIT_LOG" | grep -q '"mismatches"'; then
    pass "state_drift event has mismatches field"
  else
    fail "state_drift event has mismatches field" "$(cat "$AUDIT_LOG")"
  fi

  if grep '"event":"state_drift"' "$AUDIT_LOG" | grep -q '"ts"'; then
    pass "state_drift event has ts field"
  else
    fail "state_drift event has ts field" "$(cat "$AUDIT_LOG")"
  fi
fi

# --- TEST 4: mismatches count > 0 ---
if [ -f "$AUDIT_LOG" ]; then
  mismatches=$(grep '"event":"state_drift"' "$AUDIT_LOG" | grep -o '"mismatches":[0-9]*' | grep -o '[0-9]*$' | head -1)
  if [ "${mismatches:-0}" -gt 0 ]; then
    pass "state_drift mismatches count > 0 (got: $mismatches)"
  else
    fail "state_drift mismatches count > 0" "got: $mismatches"
  fi
fi

# -----------------------------------------------------------------------
# TEST SCENARIO B: Clean case — INDEX matches epic-progress exactly
# -----------------------------------------------------------------------
INDEX_CLEAN="$TMP/EPIC_INDEX_clean.md"
AUDIT_LOG2="$TMP/audit2.jsonl"

cat > "$INDEX_CLEAN" << 'EOF'
# EPIC_INDEX

<!-- PHASE_STATUS_START -->
| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1, E2 | ✅ Complete |
| Phase 2 | E3 | ⬜ Pending |
<!-- PHASE_STATUS_END -->

<!-- EPIC_MATRIX_START -->
| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E1 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — DONE |
| E2 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 1 — DONE |
| E3 | ✅ | 🔄 | ⬜ | ⬜ | ⬜ | Phase 2 — in-progress |
<!-- EPIC_MATRIX_END -->
EOF

# --- TEST 5: exits 0 when no mismatch ---
set +e
AUDIT_LOG="$AUDIT_LOG2" PROGRESS_FILE="$PROGRESS" INDEX_FILE="$INDEX_CLEAN" \
  bash "$CHECK" 2>/dev/null
EXIT_CODE2=$?
set -e

if [ "$EXIT_CODE2" -eq 0 ]; then
  pass "check-drift.sh exits 0 when no mismatch"
else
  fail "check-drift.sh exits 0 when no mismatch" "exit code: $EXIT_CODE2 (expected 0)"
fi

# --- TEST 6: no state_drift events when clean ---
if [ ! -f "$AUDIT_LOG2" ] || ! grep -q '"event":"state_drift"' "$AUDIT_LOG2" 2>/dev/null; then
  pass "no state_drift event when clean"
else
  fail "no state_drift event when clean" "unexpected state_drift in clean run"
fi

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
