#!/usr/bin/env bash
# E358 — regression test: check-orphan-exports.mjs built a `.test()`-driving regex with the
# global `g` flag OUTSIDE the per-file loop, then called `.test()` on it repeatedly across
# different strings. A global regex's `.test()` advances `lastIndex` on every call, so
# consecutive calls on DIFFERENT strings alternate true/false/true even when every string
# contains the symbol — undercounting production references and misreporting a genuinely wired
# export (e.g. `nextFailedState`, `consumeNonce`) as an orphan.
#
# Real incident this guards against (see docs/epics/e358-orphan-exports-stateful-regex.md): the
# false positive surfaced right when reviewing NEW code (E355's nextFailedState), which is
# exactly when a misleading "no call-sites" report does the most damage.
#
# Isolation (load-bearing): check-orphan-exports.mjs honors an ORPHAN_CHECK_APP_DIR env override
# (added by this epic — the script previously had NO way to point it away from the real
# next-app/ tree). Every invocation below sets it to a path inside a mktemp dir. This test must
# NEVER read or write the real next-app/ tree. A prior epic in this project (see
# docs/context/bugfix-log.md) shipped a test that forgot to inject paths, silently read the real
# files, and left `make hook-test` 5/9 red for a long time — do not repeat that.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT/scripts/check-orphan-exports.mjs"

if [ ! -f "$SCRIPT" ]; then
  echo "FAIL: check-orphan-exports.mjs not found at $SCRIPT" >&2
  exit 1
fi

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; echo "    $2"; FAIL=$((FAIL + 1)); }

# ---------------------------------------------------------------------------
# Part 1 — direct regex-semantics proof (no files, no fixture): the exact
# repro from the epic. A shared global-flag regex's `.test()` alternates
# true/false/true across 3 calls on 3 different strings that each contain
# the symbol; a shared NON-global regex's `.test()` returns true all 3 times
# (Acceptance #1: "same symbol in 3+ files -> 3/3 true").
# ---------------------------------------------------------------------------
regex_proof_out=$(node --input-type=module -e '
const strings = ["nextFailedState foo", "bar nextFailedState baz", "nextFailedState qux quux"]

const buggy = new RegExp("\\bnextFailedState\\b", "g")
const buggyResults = strings.map((s) => buggy.test(s))

const fixed = new RegExp("\\bnextFailedState\\b")
const fixedResults = strings.map((s) => fixed.test(s))

console.log("buggy:" + JSON.stringify(buggyResults))
console.log("fixed:" + JSON.stringify(fixedResults))
' 2>&1)

echo "$regex_proof_out"

if printf "%s" "$regex_proof_out" | grep -q "buggy:\[true,false,true\]"; then
  pass "documents the bug: shared GLOBAL regex .test() alternates true/false/true across 3 strings"
else
  fail "documents the bug: shared GLOBAL regex .test() alternates true/false/true across 3 strings" "$regex_proof_out"
fi

if printf "%s" "$regex_proof_out" | grep -q "fixed:\[true,true,true\]"; then
  pass "fix confirmed: shared NON-GLOBAL regex .test() returns true/true/true across 3 strings"
else
  fail "fix confirmed: shared NON-GLOBAL regex .test() returns true/true/true across 3 strings" "$regex_proof_out"
fi

# ---------------------------------------------------------------------------
# Part 2 — end-to-end fixture: run the REAL script (via ORPHAN_CHECK_APP_DIR)
# against a throwaway tree shaped like next-app/, never the real repo.
#
# This exact shape was verified (during this epic's implementation) to flip the
# ORIGINAL buggy script from "no orphans" to a false positive, and confirmed fixed
# on the current script — so this is not a hypothetical shape, it is the real
# mechanism (see PR discussion / e358 report for the raw before/after transcript):
#
#   1. `lib/single.test.ts` is checked FIRST (readdir sorts "single.test.ts" before
#      "single.ts" lexicographically) and contains a long filler comment BEFORE the
#      symbol reference, so the match ends at a high character offset.
#   2. The buggy shared GLOBAL regex's `.test()` carries that offset as `lastIndex`
#      into the NEXT call — on `actions/only.ts`, a short file whose length is well
#      under that offset — so the search starts past the end of the string and
#      `.test()` returns false even though the symbol is right there. That miscounts
#      the genuine production reference as 0, meanwhile the test-file hit already
#      counted `test++` — exactly `prod === 0 && test > 0` → false orphan.
# ---------------------------------------------------------------------------
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/lib" "$TMP/actions"

# Defining file — excluded from the reference count by construction (f === file).
cat >"$TMP/lib/single.ts" <<'EOF'
export function singleUseHelper(x: number): number {
  return x + 1
}
EOF

# Test file, checked first. ~400 chars of filler before the symbol reference pushes
# the match's end offset well past the length of the short production file below.
FILLER=$(printf 'x%.0s' $(seq 1 400))
{
  echo "// $FILLER"
  echo 'import { singleUseHelper } from "./single"'
  echo 'test("x", () => { expect(singleUseHelper(1)).toBe(2) })'
} >"$TMP/lib/single.test.ts"

# The ONLY real call-site — short, well under 400 chars.
cat >"$TMP/actions/only.ts" <<'EOF'
import { singleUseHelper } from "../lib/single"
export const a = singleUseHelper(1)
EOF

# `onlyTested` — a genuine orphan (tested, zero production references) — sanity-checks the
# detector still flags real orphans after the fix (must not just always say "all clear").
cat >"$TMP/lib/only-tested.ts" <<'EOF'
export function onlyTested(x: number): number {
  return x * 2
}
EOF

cat >"$TMP/lib/only-tested.test.ts" <<'EOF'
import { onlyTested } from "./only-tested"
test("onlyTested", () => {
  expect(onlyTested(2)).toBe(4)
})
EOF

out=$(ORPHAN_CHECK_APP_DIR="$TMP" node "$SCRIPT" 2>&1)
rc=$?

echo "$out"

if [ "$rc" -eq 0 ]; then
  pass "script exits 0 (non-strict) against the fixture"
else
  fail "script exits 0 (non-strict) against the fixture" "rc=$rc"
fi

if printf "%s" "$out" | grep -q "singleUseHelper"; then
  fail "singleUseHelper (the one real call-site, deliberately positioned to trigger the old lastIndex-spillover bug) is NOT reported as an orphan" "$out"
else
  pass "singleUseHelper (the one real call-site, deliberately positioned to trigger the old lastIndex-spillover bug) is NOT reported as an orphan"
fi

if printf "%s" "$out" | grep -q "onlyTested"; then
  pass "onlyTested (tested, zero production references) IS still correctly reported as an orphan"
else
  fail "onlyTested (tested, zero production references) IS still correctly reported as an orphan" "$out"
fi

# ---------------------------------------------------------------------------
# Wiring check: the `.test()` regex must not carry the `g` flag (static grep,
# guards against the fix being reverted by a future edit).
# ---------------------------------------------------------------------------
if grep -qE 'const ref = new RegExp\(`\\\\b\$\{name\}\\\\b`\)$' "$SCRIPT"; then
  pass "the .test()-driving regex (ref) has no g flag in source"
else
  fail "the .test()-driving regex (ref) has no g flag in source" "$(grep -n 'new RegExp' "$SCRIPT")"
fi

echo "----"
TOTAL=$((PASS + FAIL))
echo "$PASS/$TOTAL passed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
