#!/bin/bash
# Regression fixture for the stop-verifier block-flag writer.
#
# stop-verifier.sh touches $STOP_VERIFIER_BLOCK_FLAG (default
# .claude/.stop-verifier-blocked) whenever it blocks (exit 2), so
# subagent-stop-writeback.sh can report agent_complete status="failure" for
# the run (E146 contract). This fixture drives a REAL violation (Rule 1 —
# inline style= colour override, same pattern as test-rule-nextjs-invariants.sh)
# via CHANGED_OVERRIDE and asserts:
#   (a) a violating run creates the flag file.
#   (b) a clean run leaves no flag file (doesn't touch a stale one either).
#
# Run via `make guard-selftest` / `make hook-test`.
set -u

ROOT="$(git rev-parse --show-toplevel)"
VERIFIER="$ROOT/scripts/hooks/stop-verifier.sh"
FIX_REL="next-app/components/__verifier_fixtures__"
FIX_ABS="$ROOT/$FIX_REL"

cleanup() { rm -rf "$FIX_ABS"; rm -f "$FLAG"; }
mkdir -p "$FIX_ABS"

PASS=0
FAIL=0

FLAG="$(mktemp -u)"
trap cleanup EXIT

# ---- (a) violating run creates the flag file ----
rm -f "$FLAG"
printf 'export function X(){return <div style={{ color: "red" }} />}\n' > "$FIX_ABS/bad-style.tsx"
CHANGED_OVERRIDE="$FIX_REL/bad-style.tsx" STOP_RULE_23_ENABLED=0 BRANCH_OVERRIDE="main" \
  STOP_VERIFIER_BLOCK_FLAG="$FLAG" \
  bash "$VERIFIER" >/dev/null 2>&1
GOT=$?
if [ "$GOT" = "2" ] && [ -f "$FLAG" ]; then
  echo "  ✅ violating run: exit 2 AND flag file created"
  PASS=$((PASS + 1))
else
  echo "  ❌ violating run: expected exit 2 + flag file, got exit=$GOT flag_exists=$([ -f "$FLAG" ] && echo yes || echo no)"
  FAIL=$((FAIL + 1))
fi
rm -f "$FIX_ABS/bad-style.tsx" "$FLAG"

# ---- (b) clean run leaves no flag file ----
printf 'export function X(){return <div className="text-destructive" />}\n' > "$FIX_ABS/good.tsx"
CHANGED_OVERRIDE="$FIX_REL/good.tsx" STOP_RULE_23_ENABLED=0 BRANCH_OVERRIDE="main" \
  STOP_VERIFIER_BLOCK_FLAG="$FLAG" \
  bash "$VERIFIER" >/dev/null 2>&1
GOT=$?
if [ "$GOT" = "0" ] && [ ! -f "$FLAG" ]; then
  echo "  ✅ clean run: exit 0 AND no flag file"
  PASS=$((PASS + 1))
else
  echo "  ❌ clean run: expected exit 0 + no flag file, got exit=$GOT flag_exists=$([ -f "$FLAG" ] && echo yes || echo no)"
  FAIL=$((FAIL + 1))
fi
rm -f "$FIX_ABS/good.tsx"

echo "----"
echo "$PASS/$((PASS + FAIL)) passed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
