#!/bin/bash
# E282 — Next.js Stop-verifier rule fixtures.
# Drives stop-verifier.sh with synthetic next-app/ violations (via CHANGED_OVERRIDE)
# and asserts it BLOCKS (exit 2) on a violation and PASSES (exit 0) when clean.
# Run via `make guard-selftest`. Proves the rewritten verifier actually fires on the
# real codebase (the pre-rewrite verifier was structurally blind to next-app/).
set -u

ROOT="$(git rev-parse --show-toplevel)"
VERIFIER="$ROOT/scripts/hooks/stop-verifier.sh"
FIX_REL="next-app/components/__verifier_fixtures__"
FIX_ABS="$ROOT/$FIX_REL"
ACT_REL="next-app/actions/__verifier_fixture__.ts"
ACT_ABS="$ROOT/$ACT_REL"

cleanup() { rm -rf "$FIX_ABS" "$ACT_ABS"; }
trap cleanup EXIT
mkdir -p "$FIX_ABS"

PASS=0
FAIL=0
# run <name> <changed-paths> <expected-exit>
run() {
  CHANGED_OVERRIDE="$2" STOP_RULE_23_ENABLED=0 BRANCH_OVERRIDE="main" \
    bash "$VERIFIER" >/dev/null 2>&1
  local got=$?
  if [ "$got" = "$3" ]; then
    echo "  ✅ $1 (exit $got)"; PASS=$((PASS + 1))
  else
    echo "  ❌ $1 (exit $got, expected $3)"; FAIL=$((FAIL + 1))
  fi
}

echo "=== E282 Next.js verifier rules ==="

# Rule 1 — inline style= colour override blocks; clean className passes.
printf 'export function X(){return <div style={{ color: "red" }} />}\n' > "$FIX_ABS/bad-style.tsx"
run "Rule 1: inline style colour BLOCKS" "$FIX_REL/bad-style.tsx" 2
rm -f "$FIX_ABS/bad-style.tsx"
printf 'export function X(){return <div className="text-destructive" />}\n' > "$FIX_ABS/good.tsx"
run "Rule 1: clean className PASSES" "$FIX_REL/good.tsx" 0
rm -f "$FIX_ABS/good.tsx"

# Rule 2 — mutating Server Action without a guard blocks; with a guard passes.
printf '"use server"\nimport { db } from "@/lib/db"\nexport async function x(){ await db.insert(foo).values({}) }\n' > "$ACT_ABS"
run "Rule 2: unguarded mutating action BLOCKS" "$ACT_REL" 2
printf '"use server"\nimport { db } from "@/lib/db"\nimport { requireEditor } from "@/lib/permissions"\nexport async function x(){ await requireEditor(); await db.insert(foo).values({}) }\n' > "$ACT_ABS"
run "Rule 2: guarded mutating action PASSES" "$ACT_REL" 0
rm -f "$ACT_ABS"

# Rule 2 (E319) — guard-family widening: requireRole/requireFlag/guard() also pass.
printf '"use server"\nimport { db } from "@/lib/db"\nimport { requireRole } from "@/lib/permissions"\nexport async function x(){ await requireRole("admin"); await db.insert(foo).values({}) }\n' > "$ACT_ABS"
run "Rule 2: requireRole() guard-family PASSES" "$ACT_REL" 0
rm -f "$ACT_ABS"
printf '"use server"\nimport { db } from "@/lib/db"\nexport async function x(){ await guard(role, "flag"); await db.insert(foo).values({}) }\n' > "$ACT_ABS"
run "Rule 2: guard() helper PASSES" "$ACT_REL" 0
rm -f "$ACT_ABS"

# Rule 2 (E319) — the `// stop-verifier:public-action` marker exempts genuine pre-auth
# endpoints (login/password-reset) that legitimately have no RBAC guard.
printf '"use server"\n// stop-verifier:public-action — pre-auth login endpoint, no session exists yet\nimport { db } from "@/lib/db"\nexport async function login(){ await db.insert(sessions).values({}) }\n' > "$ACT_ABS"
run "Rule 2: public-action marker on unguarded action PASSES" "$ACT_REL" 0
rm -f "$ACT_ABS"

# Rule 4 — console.log in next-app production code blocks (global grep).
printf 'export function Y(){ console.log("x"); return null }\n' > "$FIX_ABS/logbad.tsx"
run "Rule 4: console.log BLOCKS" "$FIX_REL/logbad.tsx" 2
rm -f "$FIX_ABS/logbad.tsx"

echo ""
echo "Passed: $PASS | Failed: $FAIL"
[ "$FAIL" = "0" ] || { echo "Next.js verifier rules are not firing correctly."; exit 1; }
echo "✅ Next.js Stop-verifier rules fire correctly."
