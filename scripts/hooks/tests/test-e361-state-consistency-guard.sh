#!/usr/bin/env bash
# E361 — regression test: scripts/state/check-consistency.sh detects the two
# real incidents this epic exists for, stays clean on `main`'s real state
# file (the most important assertion — a false positive here would block
# every commit/merge in the repo), and is wired into pre-merge-check.sh's
# "State internal consistency" gate.
#
# Distinct from scripts/hooks/tests/test-e353-state-drift-gate.sh: that test
# covers check-drift.sh (are epic-progress.md and EPIC_INDEX.md in sync).
# This test covers check-consistency.sh (is epic-progress.md's OWN content
# self-contradictory) — see check-consistency.sh's header comment for why
# these are two different gates, not one.
#
# Isolation (load-bearing, per the same lesson E353's test already
# documents): check-consistency.sh honors PROGRESS_FILE / AUDIT_LOG env
# overrides. Every invocation below sets both to paths inside a mktemp
# dir — this test must NEVER write to the real
# docs/context/epic-progress.md or the real .claude/audit.jsonl. Git status
# is snapshotted before and after the whole test to prove that, byte for
# byte.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CHECK_CONSISTENCY="$ROOT/scripts/state/check-consistency.sh"
REAL_PROGRESS="$ROOT/docs/context/epic-progress.md"

if [ ! -x "$CHECK_CONSISTENCY" ]; then
  echo "FAIL: check-consistency.sh not executable at $CHECK_CONSISTENCY" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; echo "    $2"; FAIL=$((FAIL + 1)); }

STATUS_BEFORE=$(cd "$ROOT" && git status --porcelain 2>/dev/null)

# ---------------------------------------------------------------------------
# Test 1 — reproduce accident 2 (Phase 86 / E356): commit=✅ (and every
# other step) while implement is put back to ⬜. Time-impossible sequence —
# the guard must name the epic and the two disagreeing cells.
# ---------------------------------------------------------------------------
ACC2="$TMP/accident2.md"
cp "$REAL_PROGRESS" "$ACC2"

if ! grep -qE '^\| E356 \| ✅ \| ✅ \| ✅ \| ✅ \| ✅ \|' "$ACC2"; then
  echo "FAIL: fixture assumption broken — E356's matrix row is not all-✅ in the real state file; pick a different epic row" >&2
  exit 1
fi

python3 - "$ACC2" <<'PY' 2>/dev/null || perl -0pi -e 's/(\| E356 \| ✅ \| )✅( \| )/${1}⬜${2}/' "$ACC2"
import re, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()
pattern = re.compile(r"^\| E356 \| ✅ \| ✅ \| ")
new_text, n = pattern.subn("| E356 | ✅ | ⬜ | ", text, count=1, flags=re.MULTILINE)
if n != 1:
    sys.exit(1)
with open(path, "w", encoding="utf-8") as f:
    f.write(new_text)
PY

if ! grep -qE '^\| E356 \| ✅ \| ⬜ \| ✅ \|' "$ACC2"; then
  echo "FAIL: accident-2 fixture corruption did not land as expected" >&2
  grep -n '| E356 |' "$ACC2" >&2
  exit 1
fi

acc2_out=$(PROGRESS_FILE="$ACC2" AUDIT_LOG="$TMP/audit1.jsonl" bash "$CHECK_CONSISTENCY" 2>&1)
acc2_rc=$?

if [ "$acc2_rc" -ne 0 ]; then
  pass "check-consistency.sh exits non-zero on E356's impossible sequence (QA=done, Impl=pending) (rc=$acc2_rc)"
else
  fail "check-consistency.sh exits non-zero on the accident-2 fixture" "rc=$acc2_rc, output: $acc2_out"
fi

if printf '%s' "$acc2_out" | grep -q 'E356:.*Impl=⬜'; then
  pass "check-consistency.sh names the epic and the blocking cell (E356 ... Impl=⬜)"
else
  fail "check-consistency.sh names the epic and the blocking cell" "output: $acc2_out"
fi

# ---------------------------------------------------------------------------
# Test 2 — reproduce accident 3 (Phase 86 close-out): use the REAL pre-fix
# content of epic-progress.md (the commit before PR #148's one-line fix),
# where Phase 86's 4 epics are all fully ✅ but the Phase Status row still
# reads "🟢 APPROVED" instead of "✅ Complete".
# ---------------------------------------------------------------------------
FIX_COMMIT="5380d6a1a348608216dcf21b52508df1eb50b3a0"
ACC3="$TMP/accident3.md"

if ! (cd "$ROOT" && git cat-file -e "${FIX_COMMIT}^" 2>/dev/null); then
  echo "SKIP: fix commit $FIX_COMMIT not reachable in this checkout (shallow clone?) — skipping accident-3 fixture test" >&2
else
  (cd "$ROOT" && git show "${FIX_COMMIT}^:docs/context/epic-progress.md") > "$ACC3" 2>/dev/null

  if ! grep -q '| Phase 86 | E353, E354, E355, E356 | 🟢 APPROVED' "$ACC3"; then
    echo "FAIL: accident-3 fixture assumption broken — pre-fix Phase 86 row not found as expected" >&2
    grep -n '| Phase 86 ' "$ACC3" >&2
    exit 1
  fi

  acc3_out=$(PROGRESS_FILE="$ACC3" AUDIT_LOG="$TMP/audit2.jsonl" bash "$CHECK_CONSISTENCY" 2>&1)
  acc3_rc=$?

  if [ "$acc3_rc" -ne 0 ]; then
    pass "check-consistency.sh exits non-zero on the real pre-PR#148 Phase 86 row (rc=$acc3_rc)"
  else
    fail "check-consistency.sh exits non-zero on the accident-3 fixture" "rc=$acc3_rc, output: $acc3_out"
  fi

  if printf '%s' "$acc3_out" | grep -q 'Phase 86:'; then
    pass "check-consistency.sh names the drifted phase (Phase 86)"
  else
    fail "check-consistency.sh names the drifted phase" "output: $acc3_out"
  fi
fi

# ---------------------------------------------------------------------------
# Test 3 — the most important assertion: `main`'s REAL epic-progress.md
# (283 epics, 72 phases as of Phase 87) must pass clean. A false positive
# here blocks pre-merge-check.sh for every future commit.
# ---------------------------------------------------------------------------
real_out=$(PROGRESS_FILE="$REAL_PROGRESS" AUDIT_LOG="$TMP/audit3.jsonl" bash "$CHECK_CONSISTENCY" 2>&1)
real_rc=$?

if [ "$real_rc" -eq 0 ]; then
  pass "check-consistency.sh exits 0 on the real docs/context/epic-progress.md (no false positive)"
else
  fail "check-consistency.sh exits 0 on the real epic-progress.md" "rc=$real_rc, output: $real_out"
fi

# ---------------------------------------------------------------------------
# Test 4 — wiring check: pre-merge-check.sh must actually call
# check-consistency.sh (static grep — not a full pre-merge-check.sh run,
# which is far too slow for a hook regression test and covered separately
# by the epic's manual verification step).
# ---------------------------------------------------------------------------
PMC="$ROOT/scripts/pre-merge-check.sh"
if grep -q 'scripts/state/check-consistency.sh' "$PMC"; then
  pass "pre-merge-check.sh calls check-consistency.sh"
else
  fail "pre-merge-check.sh calls check-consistency.sh" "grep found nothing in $PMC"
fi

# ---------------------------------------------------------------------------
# Test 5 — this test process must not have touched the real repo state at
# all: git status --porcelain must be byte-identical before and after.
# ---------------------------------------------------------------------------
STATUS_AFTER=$(cd "$ROOT" && git status --porcelain 2>/dev/null)
if [ "$STATUS_BEFORE" = "$STATUS_AFTER" ]; then
  pass "git status --porcelain is byte-identical before/after this test run"
else
  fail "git status --porcelain is byte-identical before/after this test run" "before: [$STATUS_BEFORE] after: [$STATUS_AFTER]"
fi

echo "----"
TOTAL=$((PASS + FAIL))
echo "$PASS/$TOTAL passed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
