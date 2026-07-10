#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# test-state-update.sh — fixture-driven tests for state-update.sh
#
# Builds a small epic-progress.md + EPIC_INDEX.md fixture pair, drives
# state-update.sh via STATE_PROGRESS_PATH / STATE_INDEX_PATH / AUDIT_LOG_PATH
# env overrides, and asserts: happy path, unknown epic, idempotency,
# case-insensitive epic id, and Notes-column note update (with Phase-N prefix
# preserved). Also spot-checks the merge/awaiting-merge special case and the
# EPIC_INDEX.md sync via render-index.sh.
#
# Exit 0 = all pass; exit 1 = at least one failure.
# -----------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_UPDATE="$SCRIPT_DIR/../state-update.sh"

if [ ! -x "$STATE_UPDATE" ]; then
  echo "FAIL: state-update.sh not executable at $STATE_UPDATE" >&2
  exit 1
fi

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() {
  echo "FAIL: $1"
  echo "  expected: $2"
  echo "  got:      $3"
  FAIL=$((FAIL + 1))
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fresh_fixtures() {
  PROGRESS="$TMP/epic-progress.md"
  INDEX="$TMP/EPIC_INDEX.md"
  AUDIT="$TMP/audit.jsonl"
  rm -f "$AUDIT"

  cat > "$PROGRESS" << 'EOF'
# Epic Progress Tracker

## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1, E2 | ⬜ Pending |

## Epic Step Matrix

| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E1 | ✅ | ✅ | ⬜ | ⬜ | ⬜ | Phase 1 — DONE |
| E2 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — DONE |
EOF

  cat > "$INDEX" << 'EOF'
# EPIC_INDEX

<!-- PHASE_STATUS_START -->
| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1, E2 | ⬜ Pending |
<!-- PHASE_STATUS_END -->

<!-- EPIC_MATRIX_START -->
| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | old stale data |
| E2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | old stale data |
<!-- EPIC_MATRIX_END -->
EOF
}

run_su() {
  STATE_PROGRESS_PATH="$PROGRESS" STATE_INDEX_PATH="$INDEX" AUDIT_LOG_PATH="$AUDIT" \
    bash "$STATE_UPDATE" "$@"
}

# -----------------------------------------------------------------------
# TEST 1: Happy path — E1 qa done
# -----------------------------------------------------------------------
fresh_fixtures
run_su E1 qa done >/dev/null 2>&1
EXIT1=$?
row=$(grep '| E1 |' "$PROGRESS")
if [ "$EXIT1" -eq 0 ] && printf '%s' "$row" | grep -q '| E1 | ✅ | ✅ | ✅ | ⬜ | ⬜ |'; then
  pass "happy path: E1 qa done updates QA cell, exits 0"
else
  fail "happy path: E1 qa done updates QA cell, exits 0" "exit 0, QA cell ✅" "exit $EXIT1, row: $row"
fi

# EPIC_INDEX.md should be synced via render-index.sh
if grep '| E1 |' "$INDEX" | grep -q '✅'; then
  pass "happy path: EPIC_INDEX.md synced via render-index.sh"
else
  got=$(grep '| E1 |' "$INDEX" | head -1)
  fail "happy path: EPIC_INDEX.md synced via render-index.sh" "row with ✅" "$got"
fi

# Audit event emitted
if [ -f "$AUDIT" ] && grep -q '"event":"state_update"' "$AUDIT" && grep -q '"epic":"E1"' "$AUDIT" && grep -q '"step":"qa"' "$AUDIT" && grep -q '"status":"done"' "$AUDIT"; then
  pass "happy path: state_update audit event emitted with correct fields"
else
  fail "happy path: state_update audit event emitted with correct fields" "event with epic=E1 step=qa status=done" "$(cat "$AUDIT" 2>/dev/null)"
fi

# -----------------------------------------------------------------------
# TEST 2: Unknown epic — exits 1, does not create a row
# -----------------------------------------------------------------------
fresh_fixtures
run_su E999 spec done >/tmp/state-update-test2.out 2>&1
EXIT2=$?
if [ "$EXIT2" -ne 0 ]; then
  pass "unknown epic: exits non-zero"
else
  fail "unknown epic: exits non-zero" "exit != 0" "exit $EXIT2"
fi
if ! grep -q 'E999' "$PROGRESS"; then
  pass "unknown epic: no row created in epic-progress.md"
else
  fail "unknown epic: no row created in epic-progress.md" "no E999 row" "E999 row present"
fi

# -----------------------------------------------------------------------
# TEST 3: Idempotency — setting a cell to its current value is a no-op
# -----------------------------------------------------------------------
fresh_fixtures
run_su E2 qa done >/dev/null 2>&1   # E2 QA is already ✅ in the fixture
EXIT3=$?
CHECKSUM_BEFORE=$(md5 -q "$PROGRESS" 2>/dev/null || md5sum "$PROGRESS" 2>/dev/null | awk '{print $1}')
run_su E2 qa done >/dev/null 2>&1
CHECKSUM_AFTER=$(md5 -q "$PROGRESS" 2>/dev/null || md5sum "$PROGRESS" 2>/dev/null | awk '{print $1}')
if [ "$EXIT3" -eq 0 ] && [ "$CHECKSUM_BEFORE" = "$CHECKSUM_AFTER" ]; then
  pass "idempotency: re-applying the same status is a no-op success"
else
  fail "idempotency: re-applying the same status is a no-op success" "exit 0, checksum unchanged" "exit $EXIT3, before=$CHECKSUM_BEFORE after=$CHECKSUM_AFTER"
fi

# -----------------------------------------------------------------------
# TEST 4: Case-insensitive epic id
# -----------------------------------------------------------------------
fresh_fixtures
run_su e1 commit done >/dev/null 2>&1
EXIT4=$?
row4=$(grep '| E1 |' "$PROGRESS")
if [ "$EXIT4" -eq 0 ] && printf '%s' "$row4" | grep -q '| E1 | ✅ | ✅ | ⬜ | ✅ | ⬜ |'; then
  pass "case-insensitive epic id: 'e1' resolves to E1 row"
else
  fail "case-insensitive epic id: 'e1' resolves to E1 row" "exit 0, Commit cell ✅" "exit $EXIT4, row: $row4"
fi

# -----------------------------------------------------------------------
# TEST 5: --note updates the Notes column, preserving the "Phase N —" prefix
# -----------------------------------------------------------------------
fresh_fixtures
run_su E1 implement in-progress --note "retrying after flaky build" >/dev/null 2>&1
EXIT5=$?
row5=$(grep '| E1 |' "$PROGRESS")
if [ "$EXIT5" -eq 0 ] && printf '%s' "$row5" | grep -q 'Phase 1 — retrying after flaky build'; then
  pass "note update: preserves 'Phase N —' prefix and replaces the rest"
else
  fail "note update: preserves 'Phase N —' prefix and replaces the rest" "Phase 1 — retrying after flaky build" "$row5"
fi

# -----------------------------------------------------------------------
# TEST 6: merge + awaiting-merge special case writes full text into the
# merge cell itself (loop.md publish-protocol convention), not the Notes column
# -----------------------------------------------------------------------
fresh_fixtures
run_su E1 merge awaiting-merge --note "PR #85" >/dev/null 2>&1
EXIT6=$?
row6=$(grep '| E1 |' "$PROGRESS")
if [ "$EXIT6" -eq 0 ] && printf '%s' "$row6" | grep -q '⏸ awaiting human merge (PR #85)' && printf '%s' "$row6" | grep -q 'Phase 1 — DONE'; then
  pass "merge awaiting-merge: writes full text into merge cell, Notes column untouched"
else
  fail "merge awaiting-merge: writes full text into merge cell, Notes column untouched" "merge cell '⏸ awaiting human merge (PR #85)', Notes 'Phase 1 — DONE'" "$row6"
fi

# -----------------------------------------------------------------------
# TEST 7: invalid step / status are rejected
# -----------------------------------------------------------------------
fresh_fixtures
run_su E1 bogus-step done >/dev/null 2>&1
EXIT7A=$?
run_su E1 spec bogus-status >/dev/null 2>&1
EXIT7B=$?
if [ "$EXIT7A" -ne 0 ] && [ "$EXIT7B" -ne 0 ]; then
  pass "invalid step/status both rejected with non-zero exit"
else
  fail "invalid step/status both rejected with non-zero exit" "both non-zero" "step=$EXIT7A status=$EXIT7B"
fi

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
