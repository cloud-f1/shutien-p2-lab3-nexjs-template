#!/bin/bash
# E351 — Rule 25: "use server" export guard fixtures.
#
# Root cause behind two real incidents with the SAME shape (see
# docs/epics/e351-use-server-guard-rule.md): an internal-use function living
# in a `"use server"` file, where every export is a public POST endpoint and
# reachability is not decided by author intent.
#   - E346 `actions/usage.ts` recordUsage — an optional `userId` param
#     BYPASSED the guard (the guard call was textually present, just gated
#     behind a conditional a caller could skip).
#   - E350 `actions/sales-pages.ts` listSalesPages — no guard at all (a plain
#     SELECT, outside Rule 2's mutating-action scope entirely).
#
# Drives stop-verifier.sh with synthetic + real-historical fixtures (via
# CHANGED_OVERRIDE) and asserts it BLOCKS (exit 2) on a violation and PASSES
# (exit 0) when clean. Matches the E282 fixture pattern (test-rule-nextjs-
# invariants.sh) — real next-app/ paths, not a throwaway git repo (this is a
# per-file rule, like Rules 1/2/4, not global state like 18/24).
set -u

ROOT="$(git rev-parse --show-toplevel)"
VERIFIER="$ROOT/scripts/hooks/stop-verifier.sh"
ACT_REL="next-app/actions/__verifier_fixture_r25__.ts"
ACT_ABS="$ROOT/$ACT_REL"

cleanup() { rm -f "$ACT_ABS"; }
trap cleanup EXIT

PASS=0
FAIL=0
run() {
  CHANGED_OVERRIDE="$2" STOP_RULE_23_ENABLED=0 BRANCH_OVERRIDE="main" \
    bash "$VERIFIER" >/tmp/rule25-out.$$.txt 2>&1
  local got=$?
  if [ "$got" = "$3" ]; then
    echo "  ✅ $1 (exit $got)"; PASS=$((PASS + 1))
  else
    echo "  ❌ $1 (exit $got, expected $3)"; FAIL=$((FAIL + 1))
    sed 's/^/      /' /tmp/rule25-out.$$.txt
  fi
  rm -f /tmp/rule25-out.$$.txt
}

echo "=== Rule 25: \"use server\" export guard (E351) ==="

# 1. Guarded (unconditional requireAuth as the first statement) -> PASS.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"
export async function readOne() {
  const session = await requireAuth()
  return session.user.id
}
EOF
run "guarded export PASSES" "$ACT_REL" 0

# 2. No guard anywhere -> BLOCK.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { db } from "@/lib/db"
export async function listAll() {
  return db.select().from(fooTable)
}
EOF
run "unguarded export BLOCKS" "$ACT_REL" 2

# 3. `// stop-verifier:public-action` marker -> PASS (reuses the existing
#    Rule 2 escape hatch; no second marker convention).
cat > "$ACT_ABS" <<'EOF'
"use server"
// stop-verifier:public-action — pre-auth endpoint, no session exists yet.
import { db } from "@/lib/db"
export async function login() {
  return db.select().from(usersTable)
}
EOF
run "public-action marker PASSES" "$ACT_REL" 0

# 4. defineAction()-wrapped mutation, called via a thin public wrapper -> PASS.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { db } from "@/lib/db"
import { defineAction } from "@/lib/define-action"
import { isAdmin } from "@/lib/permissions"

const deleteFooAction = defineAction({
  allow: isAdmin,
  schema: s,
  handler: async ({ id }, ctx) => {
    await db.delete(fooTable).where(eq(fooTable.id, id))
    return { data: {}, audit: null }
  },
})

export async function deleteFoo(id: string) {
  const result = await deleteFooAction({ id })
  return "ok" in result ? null : { error: result.error }
}
EOF
run "defineAction()-wrapped export PASSES" "$ACT_REL" 0

# 5. Guard reached only via a local (non-exported) helper, itself
#    unconditionally guarded — the real actions/webhooks.ts `ensureAdmin()`
#    shape -> PASS.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAdmin } from "@/lib/permissions"

async function ensureAdmin() {
  try {
    const session = await requireAdmin()
    return { userId: session.user.id }
  } catch {
    return { error: "forbidden" }
  }
}

export async function createSystemThing(input: { url: string }) {
  const guard = await ensureAdmin()
  if ("error" in guard) return guard
  return { ok: true }
}
EOF
run "guard via local unconditional helper PASSES" "$ACT_REL" 0

# 6. Guard call inside a try/catch (converts a thrown redirect into a friendly
#    error) is still unconditional -> PASS. Real shape: exportItems/
#    exportApiKeys/exportTeam/exportWebhooks/exportAuditLog on main.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"

export async function exportThing() {
  try {
    await requireAdmin()
  } catch {
    return { success: false, error: "forbidden" }
  }
  const rows = await db.select().from(fooTable)
  return { success: true, rows }
}
EOF
run "guard inside unconditional try/catch PASSES" "$ACT_REL" 0

# 7. E346 REGRESSION — recordUsage pre-fix shape: requireAuth() is textually
#    present but only reachable behind `if (!ownerId)`, which an optional
#    caller-supplied `userId` param bypasses. Must BLOCK — this is exactly
#    the shape that shipped to main before the E346 fix (see git show
#    f6f387e^:next-app/actions/usage.ts).
cat > "$ACT_ABS" <<'EOF'
"use server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/permissions"
import { usageEventsTable } from "@/lib/schema"

export async function recordUsage(
  metric: string,
  delta = 1,
  userId?: string,
): Promise<{ success: boolean; error?: string }> {
  let ownerId = userId
  if (!ownerId) {
    const session = await requireAuth()
    if (!session?.user?.id) {
      return { success: false, error: "not signed in" }
    }
    ownerId = session.user.id
  }

  await db.insert(usageEventsTable).values({ userId: ownerId, metric, delta })
  return { success: true }
}
EOF
run "E346 pre-fix shape (guard bypassable via optional param) BLOCKS" "$ACT_REL" 2

# 8. E350 REGRESSION — listSalesPages pre-fix shape: a plain SELECT with NO
#    guard at all, sitting in a file whose OTHER exports (defineAction-backed)
#    are correctly guarded — must BLOCK on listSalesPages specifically, and
#    the file's other exports must not mask it (see git show
#    84fb7f8^:next-app/actions/sales-pages.ts).
cat > "$ACT_ABS" <<'EOF'
"use server"
import { db } from "@/lib/db"
import { defineAction } from "@/lib/define-action"
import { isAdmin } from "@/lib/permissions"
import { salesPagesTable } from "@/lib/schema/sales"

const createSalesPageAction = defineAction({
  allow: isAdmin,
  schema: s,
  handler: async (input, ctx) => {
    const [row] = await db.insert(salesPagesTable).values(input).returning({ id: salesPagesTable.id })
    return { data: { id: row.id }, audit: null }
  },
})

export async function createSalesPage(input: unknown) {
  const result = await createSalesPageAction(input)
  return "ok" in result ? { id: result.id } : { error: result.error }
}

/** Read (admin list) — Server Component loader helper */
export async function listSalesPages() {
  return db.select().from(salesPagesTable)
}
EOF
run "E350 pre-fix shape (no guard on a read export) BLOCKS" "$ACT_REL" 2

# 9. `isAdmin(await getLiveRole(...))` — the real actions/admin-revenue.ts
#    `getMemberDetail` shape — is a recognized inline guard -> PASS.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { auth } from "@/lib/auth"
import { isAdmin, getLiveRole } from "@/lib/permissions"

export async function getMemberDetail(userId: string) {
  const session = await auth()
  const actorId = session?.user?.id
  if (!actorId) return { error: "not signed in" }
  if (!isAdmin(await getLiveRole(actorId))) return { error: "forbidden" }
  return { ok: true }
}
EOF
run "isAdmin(getLiveRole(...)) inline guard PASSES" "$ACT_REL" 0

# 10. `isAdmin(session.user.role)` on the STALE JWT-snapshotted role (the
#    exact bug security-audit SKILL.md section 2 blocks on: a demoted user's
#    token still claims the old role until re-login) must NOT be treated as a
#    guard by this rule — a bare isAdmin()/canEdit() call is a UI-only pure
#    predicate, not a guard, unless applied to a freshly re-read getLiveRole().
cat > "$ACT_ABS" <<'EOF'
"use server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"

export async function getMemberDetail(userId: string) {
  const session = await auth()
  if (!isAdmin(session?.user?.role)) return { error: "forbidden" }
  return { ok: true }
}
EOF
run "isAdmin(session.user.role) stale-JWT-role shape BLOCKS" "$ACT_REL" 2

# 11. Manual `auth()` + null-check-and-bail — the real
#    registry/billing-stripe/actions/billing.ts `createCheckoutSession` shape
#    (a QA-found false positive on the first cut of this rule: the scan has
#    no directory restriction, so this file WILL be scanned the moment
#    anyone edits it). Functionally identical to requireAuth() -> PASS.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { auth } from "@/lib/auth"

export async function createCheckoutSession(planId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to subscribe." }
  }
  return { success: true }
}
EOF
run "manual auth() + null-check-and-bail PASSES" "$ACT_REL" 0

# 12/13. THE SINGLE-LINE-IF BYPASS FIX (QA-found in the first cut): E346's
# exact shape — a guard call reachable only through a conditional — written
# on ONE line instead of multi-line. Both brace-less and self-closed-braced
# forms must BLOCK exactly like the multi-line form already does.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"
import { db } from "@/lib/db"

export async function x(skip?: boolean) {
  if (!skip) await requireAuth()
  return db.select().from(fooTable)
}
EOF
run "single-line brace-less if-gated guard BLOCKS" "$ACT_REL" 2

cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"
import { db } from "@/lib/db"

export async function x(skip?: boolean) {
  if (!skip) { requireAuth() }
  return db.select().from(fooTable)
}
EOF
run "single-line braced if-gated guard BLOCKS" "$ACT_REL" 2

# 14. Control: the check-and-bail idiom itself is a single-line if whose
# CONDITION is the guard call and which exits on failure (real shape:
# actions/admin-revenue.ts getMemberDetail, already case 9 above via a
# multi-line body) — confirm it also PASSES when the whole thing collapses
# onto one line, so the single-line-if fix does not swallow this idiom too.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAdmin } from "@/lib/permissions"

export async function y() {
  if (!(await requireAdmin())) return { error: "forbidden" }
  return { ok: true }
}
EOF
run "single-line check-and-bail (guard IN the condition) PASSES" "$ACT_REL" 0

# ---------------------------------------------------------------------------
# KNOWN BLIND SPOTS (documented, not fixed — the epic explicitly accepts
# false negatives from a grep heuristic; these assert CURRENT behavior so
# nobody "fixes" them by accident later without re-reading why they're here).
# ---------------------------------------------------------------------------

# 15. Ternary-gated guard: not tracked as conditional -> currently PASSES
# even though the guard is skippable (`cond ? requireAuth() : null`).
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"
import { db } from "@/lib/db"

export async function x(skip?: boolean) {
  skip ? null : await requireAuth()
  return db.select().from(fooTable)
}
EOF
run "[KNOWN BLIND SPOT] ternary-gated guard currently PASSES" "$ACT_REL" 0

# 16. `&&`-short-circuit-gated guard: not tracked as conditional -> currently
# PASSES.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"
import { db } from "@/lib/db"

export async function x(skip?: boolean) {
  skip || (await requireAuth())
  return db.select().from(fooTable)
}
EOF
run "[KNOWN BLIND SPOT] &&/|| short-circuit-gated guard currently PASSES" "$ACT_REL" 0

# 17. Guard inside a `switch`/`case` branch: switch/case is not tracked as
# conditional at all -> currently PASSES even though only one case reaches it.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"
import { db } from "@/lib/db"

export async function x(mode: string) {
  switch (mode) {
    case "strict":
      await requireAuth()
      break
    default:
      break
  }
  return db.select().from(fooTable)
}
EOF
run "[KNOWN BLIND SPOT] guard inside switch/case currently PASSES" "$ACT_REL" 0

# 18. Guard reachable only via a local helper that is CONDITIONALLY called
# (as opposed to case 5's unconditionally-called ensureAdmin()) -> currently
# PASSES: the rule only verifies the callee's own body, not whether/how the
# caller reaches it.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"

async function ensureAdmin() {
  await requireAdmin()
}

export async function x(skip?: boolean) {
  if (!skip) {
    await ensureAdmin()
  }
  return db.select().from(fooTable)
}
EOF
run "[KNOWN BLIND SPOT] conditionally-called local guard helper currently PASSES" "$ACT_REL" 0

# 19. Arrow-function export (block-bodied): now a recognized export boundary,
# same guard rules apply — unguarded -> BLOCKS.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { db } from "@/lib/db"

export const listAll = async () => {
  return db.select().from(fooTable)
}
EOF
run "arrow-function export, unguarded, BLOCKS" "$ACT_REL" 2

# 20. Arrow-function export, guarded -> PASSES.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"

export const readOne = async () => {
  const session = await requireAuth()
  return session.user.id
}
EOF
run "arrow-function export, guarded, PASSES" "$ACT_REL" 0

echo ""
echo "Passed: $PASS | Failed: $FAIL"
[ "$FAIL" = "0" ] || { echo "Rule 25 (E351) is not firing correctly."; exit 1; }
echo "✅ Rule 25 (\"use server\" export guard) fires correctly."
