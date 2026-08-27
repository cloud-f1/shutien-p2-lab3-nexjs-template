#!/usr/bin/env bash
# E353 — regression test: check-drift.sh is wired into pre-merge-check.sh's
# "State drift" gate, and the underlying detector correctly flags a hand-edit
# to the DERIVED file (EPIC_INDEX.md's sentinel matrix) that disagrees with
# the SSOT (epic-progress.md), then clears once reconciled via
# render-index.sh.
#
# Real incident this guards against (see docs/epics/CLAUDE.md and
# docs/epics/e353-state-drift-enforcement.md): Phase 85 was closed out by
# hand-editing EPIC_INDEX.md directly, without touching the SSOT. PR #136
# merged carrying 13 drifted cells; only caught after the fact.
#
# Isolation (load-bearing): this repo's check-drift.sh / render-index.sh
# BOTH honor PROGRESS_FILE / INDEX_FILE env overrides (and check-drift.sh
# also honors AUDIT_LOG). Every invocation below sets all three to paths
# inside a mktemp dir — this test must NEVER read or write the real
# docs/context/epic-progress.md or docs/epics/EPIC_INDEX.md. A prior epic in
# this project (see docs/context/bugfix-log.md) shipped a test that forgot to
# inject paths, silently read the real files, and produced false failures —
# do not repeat that.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CHECK_DRIFT="$ROOT/scripts/state/check-drift.sh"
RENDER_INDEX="$ROOT/scripts/state/render-index.sh"
REAL_PROGRESS="$ROOT/docs/context/epic-progress.md"
REAL_INDEX="$ROOT/docs/epics/EPIC_INDEX.md"

if [ ! -x "$CHECK_DRIFT" ]; then
  echo "FAIL: check-drift.sh not executable at $CHECK_DRIFT" >&2
  exit 1
fi
if [ ! -x "$RENDER_INDEX" ]; then
  echo "FAIL: render-index.sh not executable at $RENDER_INDEX" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; echo "    $2"; FAIL=$((FAIL + 1)); }

# ---------------------------------------------------------------------------
# Fixture: copy the real state files into TMP (read-only source of realistic
# structure), then corrupt ONLY the temp copy of EPIC_INDEX.md — flip the E0
# Impl cell in the Epic Step Matrix from its real value to a different symbol
# — this is exactly the "hand-edit the derived file's matrix cell" incident
# shape the epic describes. All subsequent commands point PROGRESS_FILE /
# INDEX_FILE / AUDIT_LOG at TMP paths only.
# ---------------------------------------------------------------------------
PROGRESS="$TMP/epic-progress.md"
INDEX="$TMP/EPIC_INDEX.md"
AUDIT="$TMP/audit.jsonl"

cp "$REAL_PROGRESS" "$PROGRESS"
cp "$REAL_INDEX" "$INDEX"

if ! grep -qE '^\| E0 \| .* \| .* \| .* \| .* \| .* \|' "$INDEX"; then
  echo "FAIL: fixture assumption broken — no '| E0 | ... |' matrix row found in EPIC_INDEX.md" >&2
  exit 1
fi

# Corrupt: change E0's Impl cell (2nd status column) to ⬜ in the temp INDEX
# copy only, leaving PROGRESS untouched — a pure derived-file drift.
python3 - "$INDEX" <<'PY' 2>/dev/null || perl -0pi -e 's/(\| E0 \| [^\|]+\| )[^\|]+(\|)/${1}⬜ ${2}/' "$INDEX"
import sys, re
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()
pattern = re.compile(r"^\| E0 \| ([^|]+) \| ([^|]+) \| ")
def repl(m):
    return f"| E0 | {m.group(1)} | ⬜ | "
new_text, n = pattern.subn(repl, text, count=1, flags=re.MULTILINE)
if n != 1:
    sys.exit(1)
with open(path, "w", encoding="utf-8") as f:
    f.write(new_text)
PY

if ! grep -qE '^\| E0 \| ✅ \| ⬜ \|' "$INDEX"; then
  echo "FAIL: fixture corruption did not land as expected in $INDEX" >&2
  sed -n '1,5p' "$INDEX" >&2
  grep -n '| E0 |' "$INDEX" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# RED: corrupted derived file vs. untouched SSOT -> check-drift.sh must
# exit non-zero and name the mismatch.
# ---------------------------------------------------------------------------
red_out=$(PROGRESS_FILE="$PROGRESS" INDEX_FILE="$INDEX" AUDIT_LOG="$AUDIT" bash "$CHECK_DRIFT" 2>&1)
red_rc=$?

if [ "$red_rc" -ne 0 ]; then
  pass "check-drift.sh exits non-zero on a hand-edited matrix cell (rc=$red_rc)"
else
  fail "check-drift.sh exits non-zero on a hand-edited matrix cell" "rc=$red_rc, output: $red_out"
fi

if printf '%s' "$red_out" | grep -q 'E0 Impl:'; then
  pass "check-drift.sh detail names the drifted epic/column (E0 Impl)"
else
  fail "check-drift.sh detail names the drifted epic/column (E0 Impl)" "output: $red_out"
fi

if [ -s "$AUDIT" ] && tail -1 "$AUDIT" | grep -q '"event":"state_drift"'; then
  pass "state_drift event landed in the injected AUDIT_LOG (not the real audit log)"
else
  fail "state_drift event landed in the injected AUDIT_LOG" "AUDIT contents: $(cat "$AUDIT" 2>/dev/null)"
fi

# ---------------------------------------------------------------------------
# Reconcile via render-index.sh (env-injected paths only), then re-check.
# ---------------------------------------------------------------------------
PROGRESS_FILE="$PROGRESS" INDEX_FILE="$INDEX" bash "$RENDER_INDEX" >/dev/null 2>&1

if grep -qE '^\| E0 \| ✅ \| ✅ \|' "$INDEX"; then
  pass "render-index.sh restores E0's Impl cell from the SSOT"
else
  fail "render-index.sh restores E0's Impl cell from the SSOT" "$(grep '| E0 |' "$INDEX")"
fi

# ---------------------------------------------------------------------------
# GREEN: after reconciling, check-drift.sh must exit 0.
# ---------------------------------------------------------------------------
green_out=$(PROGRESS_FILE="$PROGRESS" INDEX_FILE="$INDEX" AUDIT_LOG="$AUDIT" bash "$CHECK_DRIFT" 2>&1)
green_rc=$?

if [ "$green_rc" -eq 0 ]; then
  pass "check-drift.sh exits 0 after render-index.sh reconciles (rc=$green_rc)"
else
  fail "check-drift.sh exits 0 after render-index.sh reconciles" "rc=$green_rc, output: $green_out"
fi

# ---------------------------------------------------------------------------
# Wiring check: pre-merge-check.sh must actually call check-drift.sh and
# surface the render-index.sh remedy in its failure message (static grep —
# NOT a full pre-merge-check.sh run, which is covered by the epic's manual
# verification step and would be far too slow for a hook regression test).
# ---------------------------------------------------------------------------
PMC="$ROOT/scripts/pre-merge-check.sh"
if grep -q 'scripts/state/check-drift.sh' "$PMC" && grep -q 'render-index.sh' "$PMC"; then
  pass "pre-merge-check.sh calls check-drift.sh and mentions render-index.sh as the remedy"
else
  fail "pre-merge-check.sh calls check-drift.sh and mentions render-index.sh as the remedy" "grep found nothing in $PMC"
fi

echo "----"
TOTAL=$((PASS + FAIL))
echo "$PASS/$TOTAL passed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
