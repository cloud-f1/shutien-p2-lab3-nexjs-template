#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# test-render-index.sh — fixture-driven tests for render-index.sh
#
# Creates a minimal epic-progress.md snapshot (2 phases, 3 epics), runs
# render-index.sh against it, and asserts Phase Status table and Epic Step
# Matrix cells match expected values byte-for-byte.
#
# Exit 0 = all pass; exit 1 = at least one failure.
# -----------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER="$SCRIPT_DIR/../render-index.sh"

if [ ! -x "$RENDER" ]; then
  echo "FAIL: render-index.sh not executable at $RENDER" >&2
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

# Create temp workspace
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# --- Build a minimal epic-progress.md fixture ---
PROGRESS="$TMP/epic-progress.md"
cat > "$PROGRESS" << 'EOF'
# AI-Coding-Template — Epic Progress Tracker

## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1, E2 | ✅ Complete |
| Phase 2 | E3 | ⬜ Pending |

## Epic Step Matrix

<!--
Steps: spec → implement → qa → commit → merge
-->

| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E1 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — DONE PR#1 |
| E2 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 1 — DONE PR#2 |
| E3 | ✅ | 🔄 | ⬜ | ⬜ | ⬜ | Phase 2 — in-progress |

## Dependency Rules

```
E1: no deps
E2: E1
E3: no deps
```
EOF

# --- Build a minimal EPIC_INDEX.md fixture with sentinel comments ---
INDEX="$TMP/EPIC_INDEX.md"
cat > "$INDEX" << 'EOF'
# AI-Coding-Template — Epic Progress Tracker

> **Purpose**: Human-visible catalog

---

<!-- PHASE_STATUS_START -->
| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1, E2 | 🔄 In-Progress |
| Phase 2 | E3 | ⬜ Pending |
<!-- PHASE_STATUS_END -->

## Epic Step Matrix

<!-- EPIC_MATRIX_START -->
| Epic | Name | Size | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|------|------|-----|--------|-------|-------|
| E1 | - | - | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | old stale data |
| E2 | - | - | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | old stale data |
| E3 | - | - | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | old stale data |
<!-- EPIC_MATRIX_END -->

## Dependency Rules

```
E1: no deps
```

## Phase Parallelism

```
Phase 1: E1 → E2
```
EOF

# Run render-index.sh against our fixture files
PROGRESS_FILE="$PROGRESS" INDEX_FILE="$INDEX" bash "$RENDER" 2>/dev/null

# --- TEST 1: Phase Status table updated (Phase 1 should be ✅ Complete) ---
if grep -q '| Phase 1 | E1, E2 | ✅ Complete |' "$INDEX"; then
  pass "Phase 1 status updated to ✅ Complete"
else
  got=$(grep 'Phase 1' "$INDEX" | head -1)
  fail "Phase 1 status updated to ✅ Complete" "| Phase 1 | E1, E2 | ✅ Complete |" "$got"
fi

# --- TEST 2: Phase 2 stays ⬜ Pending ---
if grep -q '| Phase 2 | E3 | ⬜ Pending |' "$INDEX"; then
  pass "Phase 2 status stays ⬜ Pending"
else
  got=$(grep 'Phase 2' "$INDEX" | head -1)
  fail "Phase 2 status stays ⬜ Pending" "| Phase 2 | E3 | ⬜ Pending |" "$got"
fi

# --- TEST 3: E1 matrix row shows ✅ in Spec column ---
if grep -q '| E1 |' "$INDEX" && grep 'E1' "$INDEX" | grep -q '✅'; then
  pass "E1 matrix row contains ✅ cells"
else
  got=$(grep '| E1 |' "$INDEX" | head -1)
  fail "E1 matrix row contains ✅ cells" "row with ✅" "$got"
fi

# --- TEST 4: E2 matrix row shows ⏭️ in QA column ---
if grep 'E2' "$INDEX" | grep -q '⏭️'; then
  pass "E2 matrix row contains ⏭️ (skip) cell"
else
  got=$(grep '| E2 |' "$INDEX" | head -1)
  fail "E2 matrix row contains ⏭️ cell" "row with ⏭️" "$got"
fi

# --- TEST 5: E3 matrix row shows 🔄 in Impl column ---
if grep 'E3' "$INDEX" | grep -q '🔄'; then
  pass "E3 matrix row contains 🔄 (in-progress) cell"
else
  got=$(grep '| E3 |' "$INDEX" | head -1)
  fail "E3 matrix row contains 🔄 cell" "row with 🔄" "$got"
fi

# --- TEST 6: Prose sections (Dependency Rules) preserved unchanged ---
if grep -q 'E1: no deps' "$INDEX"; then
  pass "Dependency Rules prose preserved unchanged"
else
  fail "Dependency Rules prose preserved unchanged" "E1: no deps" "(not found)"
fi

# --- TEST 7: Phase Parallelism prose preserved ---
if grep -q 'Phase 1: E1' "$INDEX"; then
  pass "Phase Parallelism prose preserved"
else
  fail "Phase Parallelism prose preserved" "Phase 1: E1" "(not found)"
fi

# --- TEST 8: Idempotency — running twice produces same result ---
CHECKSUM1=$(md5 -q "$INDEX" 2>/dev/null || md5sum "$INDEX" 2>/dev/null | awk '{print $1}')
PROGRESS_FILE="$PROGRESS" INDEX_FILE="$INDEX" bash "$RENDER" 2>/dev/null
CHECKSUM2=$(md5 -q "$INDEX" 2>/dev/null || md5sum "$INDEX" 2>/dev/null | awk '{print $1}')
if [ "$CHECKSUM1" = "$CHECKSUM2" ]; then
  pass "render-index.sh is idempotent (second run = same output)"
else
  fail "render-index.sh is idempotent" "same checksum" "checksums differ"
fi

# --- TEST 9: Sentinel markers retained in output ---
if grep -q 'PHASE_STATUS_START' "$INDEX" && grep -q 'PHASE_STATUS_END' "$INDEX"; then
  pass "PHASE_STATUS sentinel markers retained"
else
  fail "PHASE_STATUS sentinel markers retained" "markers present" "(missing)"
fi

if grep -q 'EPIC_MATRIX_START' "$INDEX" && grep -q 'EPIC_MATRIX_END' "$INDEX"; then
  pass "EPIC_MATRIX sentinel markers retained"
else
  fail "EPIC_MATRIX sentinel markers retained" "markers present" "(missing)"
fi

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
