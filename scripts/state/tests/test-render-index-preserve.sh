#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# test-render-index-preserve.sh — prose-preserving merge tests for
# render-index.sh (the E196 gap fix: a re-render used to WIPE EPIC_INDEX.md's
# rich historical prose and DROP phase/epic rows that only exist in
# EPIC_INDEX.md; render-index.sh now merges instead of replacing).
#
# Cases:
#   1. Rich EPIC_INDEX row + same lean status in progress -> rich prose
#      preserved byte-identical (Epics cell still synced from progress).
#   2. Status changed in progress -> new status wins, prose replaced.
#   3. Phase row only in EPIC_INDEX -> preserved.
#   4. Phase row only in progress -> added.
#   5. Matrix: rich Notes preserved when progress Notes is a prefix; step
#      cells always come from progress.
#   6. Idempotency: running render twice -> identical output.
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

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# -----------------------------------------------------------------------
# Fixture: epic-progress.md (lean, state-authoritative) +
# EPIC_INDEX.md (rich prose + phase/epic rows the progress file lacks).
#
# Deliberate asymmetries baked in, mirroring the real repo:
#   Phase 1  — same lean status in both -> prose must survive
#   Phase 2  — status changed (progress moved on)   -> new status wins
#   Phase 3  — EPIC_INDEX-only row (progress has no Phase 3 at all)
#   Phase 4  — progress-only row (EPIC_INDEX has no Phase 4 at all)
#   E1  — rich Notes in INDEX, progress Notes is a prefix -> Notes survive
#   E2  — progress Notes is NOT a prefix of INDEX Notes    -> progress wins
#   E3  — INDEX-only epic row -> preserved
#   E4  — progress-only epic row -> added
# -----------------------------------------------------------------------
PROGRESS="$TMP/epic-progress.md"
INDEX="$TMP/EPIC_INDEX.md"

cat > "$PROGRESS" << 'EOF'
# Epic Progress Tracker

## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1, E2 | ✅ Complete |
| Phase 2 | E3 | ✅ Complete |
| Phase 4 | E4 | ⬜ Pending |

## Epic Step Matrix

| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E1 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — DONE |
| E2 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — shipped |
| E3 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 2 — DONE |
| E4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Phase 4 — new |
| E5 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — retried (best-effort \|\| true) |

## Dependency Rules

```
E1: no deps
```
EOF

cat > "$INDEX" << 'EOF'
# EPIC_INDEX

<!-- PHASE_STATUS_START -->
| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1, E2 | ✅ Complete (rich prose — shipped PR#1, PR#2) |
| Phase 2 | E3 | 🔄 In-Progress (was blocked on infra) |
| Phase 3 | E9 | ✅ Complete (history-only phase, no longer in progress file) |
<!-- PHASE_STATUS_END -->

<!-- EPIC_MATRIX_START -->
| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Phase 1 — DONE PR#1 with extra rich detail |
| E2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | totally unrelated old note |
| E9 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 3 — history-only epic row |
| E5 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Phase 1 — retried (best-effort \|\| true) extra detail after pipe |
<!-- EPIC_MATRIX_END -->

## Dependency Rules

```
E1: no deps
```
EOF

run_render() {
  PROGRESS_FILE="$PROGRESS" INDEX_FILE="$INDEX" bash "$RENDER" >/dev/null 2>&1
}

run_render

# -----------------------------------------------------------------------
# TEST 1: Rich EPIC_INDEX row + same lean status -> prose preserved
# byte-identical (Epics cell synced from progress, unchanged here since
# both files already agree on "E1, E2").
# -----------------------------------------------------------------------
if grep -qF '| Phase 1 | E1, E2 | ✅ Complete (rich prose — shipped PR#1, PR#2) |' "$INDEX"; then
  pass "Phase 1: rich prose preserved byte-identical (lean status matches prefix)"
else
  got=$(grep 'Phase 1' "$INDEX" | head -1)
  fail "Phase 1: rich prose preserved byte-identical" "| Phase 1 | E1, E2 | ✅ Complete (rich prose — shipped PR#1, PR#2) |" "$got"
fi

# -----------------------------------------------------------------------
# TEST 2: Status changed in progress (🔄 In-Progress -> ✅ Complete) ->
# new lean status wins, rich prose replaced.
# -----------------------------------------------------------------------
if grep -qF '| Phase 2 | E3 | ✅ Complete |' "$INDEX"; then
  pass "Phase 2: status change wins over stale prose"
else
  got=$(grep 'Phase 2' "$INDEX" | head -1)
  fail "Phase 2: status change wins over stale prose" "| Phase 2 | E3 | ✅ Complete |" "$got"
fi

# -----------------------------------------------------------------------
# TEST 3: Phase row only in EPIC_INDEX (Phase 3) -> preserved
# -----------------------------------------------------------------------
if grep -qF '| Phase 3 | E9 | ✅ Complete (history-only phase, no longer in progress file) |' "$INDEX"; then
  pass "Phase 3: EPIC_INDEX-only phase row preserved"
else
  got=$(grep 'Phase 3' "$INDEX" | head -1)
  fail "Phase 3: EPIC_INDEX-only phase row preserved" "row present unchanged" "$got"
fi

# -----------------------------------------------------------------------
# TEST 4: Phase row only in progress (Phase 4) -> added
# -----------------------------------------------------------------------
if grep -qF '| Phase 4 | E4 | ⬜ Pending |' "$INDEX"; then
  pass "Phase 4: progress-only phase row added"
else
  got=$(grep 'Phase 4' "$INDEX" | head -1)
  fail "Phase 4: progress-only phase row added" "| Phase 4 | E4 | ⬜ Pending |" "$got"
fi

# -----------------------------------------------------------------------
# TEST 5a: Matrix — rich Notes preserved when progress Notes is a prefix
# of the existing (E1: progress "Phase 1 — DONE" is a prefix of index's
# "Phase 1 — DONE PR#1 with extra rich detail").
# -----------------------------------------------------------------------
if grep -qF '| E1 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — DONE PR#1 with extra rich detail |' "$INDEX"; then
  pass "E1: rich Notes preserved (progress Notes is a prefix), step cells from progress"
else
  got=$(grep '| E1 |' "$INDEX" | head -1)
  fail "E1: rich Notes preserved, step cells from progress" "| E1 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — DONE PR#1 with extra rich detail |" "$got"
fi

# -----------------------------------------------------------------------
# TEST 5b: Matrix — progress Notes wins when it is NOT a prefix of the
# existing Notes (E2: "Phase 1 — shipped" is not a prefix of "totally
# unrelated old note").
# -----------------------------------------------------------------------
if grep -qF '| E2 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — shipped |' "$INDEX"; then
  pass "E2: progress Notes wins when not a prefix of existing Notes"
else
  got=$(grep '| E2 |' "$INDEX" | head -1)
  fail "E2: progress Notes wins when not a prefix" "| E2 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — shipped |" "$got"
fi

# -----------------------------------------------------------------------
# TEST 5c: Matrix — epic row only in EPIC_INDEX (E9) preserved
# -----------------------------------------------------------------------
if grep -qF '| E9 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 3 — history-only epic row |' "$INDEX"; then
  pass "E9: EPIC_INDEX-only epic row preserved"
else
  got=$(grep '| E9 |' "$INDEX" | head -1)
  fail "E9: EPIC_INDEX-only epic row preserved" "row present unchanged" "$got"
fi

# -----------------------------------------------------------------------
# TEST 5d: Matrix — epic row only in progress (E4) added
# -----------------------------------------------------------------------
if grep -qF '| E4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Phase 4 — new |' "$INDEX"; then
  pass "E4: progress-only epic row added"
else
  got=$(grep '| E4 |' "$INDEX" | head -1)
  fail "E4: progress-only epic row added" "| E4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Phase 4 — new |" "$got"
fi

# -----------------------------------------------------------------------
# TEST 5e: Matrix — a Notes cell containing a literal embedded "|" (e.g.
# markdown-escaped "\|\| true" from a bash snippet) must not be truncated
# by the merge's field-splitting. Regression test for a real corruption
# found during the real-file simulation (E181/E182 in the actual repo).
# E5: progress Notes "...best-effort \|\| true)" is a prefix of the richer
# existing Notes, so the existing (longer) Notes — itself containing the
# same embedded pipe — must survive intact, unterminated early.
# -----------------------------------------------------------------------
if grep -qF '| E5 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — retried (best-effort \|\| true) extra detail after pipe |' "$INDEX"; then
  pass "E5: embedded '|' in Notes survives the merge without truncation"
else
  got=$(grep '| E5 |' "$INDEX" | head -1)
  fail "E5: embedded '|' in Notes survives the merge without truncation" '| E5 | ... | Phase 1 — retried (best-effort \|\| true) extra detail after pipe |' "$got"
fi

# -----------------------------------------------------------------------
# TEST 6: Idempotency — running render twice produces identical output
# -----------------------------------------------------------------------
CHECKSUM1=$(md5 -q "$INDEX" 2>/dev/null || md5sum "$INDEX" 2>/dev/null | awk '{print $1}')
run_render
CHECKSUM2=$(md5 -q "$INDEX" 2>/dev/null || md5sum "$INDEX" 2>/dev/null | awk '{print $1}')
if [ "$CHECKSUM1" = "$CHECKSUM2" ]; then
  pass "idempotency: second render produces byte-identical output"
else
  fail "idempotency: second render produces byte-identical output" "same checksum" "checksums differ ($CHECKSUM1 vs $CHECKSUM2)"
fi

# -----------------------------------------------------------------------
# TEST 7: Prose outside the sentinel blocks is untouched
# -----------------------------------------------------------------------
if grep -qF 'E1: no deps' "$INDEX"; then
  pass "Dependency Rules prose outside sentinels preserved"
else
  fail "Dependency Rules prose outside sentinels preserved" "E1: no deps" "(not found)"
fi

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
