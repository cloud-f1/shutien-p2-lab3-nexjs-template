#!/bin/bash
# E368 — Rule 26: rows-affected check before an audit write.
#
# The class: a Server Action runs an ownership-scoped UPDATE/DELETE, ignores the
# rows-affected count, and writes its audit row unconditionally. Because Server
# Actions are public POST endpoints, a caller passing somebody else's resource id
# matches zero rows — the write is a no-op, but the audit entry lands anyway,
# attributed to the caller and naming a resource they cannot touch. That is an
# unauthenticated-ish write into the compliance surface E356/E359 hardened.
#
# `actions/items.ts` was already correct (its `result.count === 0` check even
# carries a comment explaining why). EIGHT other functions were not — the fix had
# been applied per-case rather than to the pattern. Rule 26 is what makes it hold.
#
# Fixture note: the first draft of the scanner used a single-line
# /db\s*\.\s*update\(/ pattern and matched NOTHING, because drizzle chains across
# lines (`await db` ⏎ `  .update(...)`). It reported a clean bill of health for
# all eight known-bad functions. Case 2 below is line-broken on purpose so that
# regression can never come back silently.
set -u

ROOT="$(git rev-parse --show-toplevel)"
VERIFIER="$ROOT/scripts/hooks/stop-verifier.sh"
ACT_REL="next-app/actions/__verifier_fixture_r26__.ts"
ACT_ABS="$ROOT/$ACT_REL"

cleanup() { rm -f "$ACT_ABS"; }
trap cleanup EXIT

PASS=0
FAIL=0
run() {
  CHANGED_OVERRIDE="$2" STOP_RULE_23_ENABLED=0 BRANCH_OVERRIDE="main" \
    bash "$VERIFIER" >/tmp/rule26-out.$$.txt 2>&1
  local got=$?
  if [ "$got" = "$3" ]; then
    echo "  ✅ $1 (exit $got)"; PASS=$((PASS + 1))
  else
    echo "  ❌ $1 (exit $got, expected $3)"; FAIL=$((FAIL + 1))
    sed 's/^/      /' /tmp/rule26-out.$$.txt
  fi
  rm -f /tmp/rule26-out.$$.txt
}

echo "=== Rule 26: rows-affected before audit (E368) ==="

# 1. The correct shape (actions/items.ts) -> PASS.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"
export async function revokeThing(id: string) {
  const session = await requireAuth()
  const result = await db
    .delete(thingsTable)
    .where(and(eq(thingsTable.id, id), eq(thingsTable.userId, session.user.id)))
  if (result.count === 0) {
    return { error: "not found" }
  }
  await logAudit({ actorId: session.user.id, action: "thing.revoked", targetId: id })
  return {}
}
EOF
run "count-checked write PASSES" "$ACT_REL" 0

# 2. The bug — LINE-BROKEN drizzle chain, audit written unconditionally -> BLOCK.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"
export async function revokeThing(id: string) {
  const session = await requireAuth()
  await db
    .update(thingsTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(thingsTable.id, id), eq(thingsTable.userId, session.user.id)))
  await logAudit({ actorId: session.user.id, action: "thing.revoked", targetId: id })
  return {}
}
EOF
run "unchecked write + audit BLOCKS (line-broken chain)" "$ACT_REL" 2

# 3. Same bug, single-line chain -> BLOCK.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAdmin } from "@/lib/permissions"
export async function setThingRole(id: string, role: string) {
  const session = await requireAdmin()
  await db.update(thingsTable).set({ role }).where(eq(thingsTable.id, id))
  await logAudit({ actorId: session.user.id, action: "thing.role_changed", targetId: id })
  return { success: true }
}
EOF
run "unchecked write + audit BLOCKS (single-line chain)" "$ACT_REL" 2

# 4. .returning() + null test -> PASS.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAdmin } from "@/lib/permissions"
export async function deleteThing(id: string) {
  const session = await requireAdmin()
  const [row] = await db.delete(thingsTable).where(eq(thingsTable.id, id)).returning({ id: thingsTable.id })
  if (!row) return { error: "not found" }
  await logAudit({ actorId: session.user.id, action: "thing.deleted", targetId: id })
  return {}
}
EOF
run ".returning() + null test PASSES" "$ACT_REL" 0

# 5. Existence proven by a prior SELECT + missing-row guard -> PASS.
#    This is actions/team.ts acceptInvitation. Without this exemption the rule
#    cries wolf on correct code, and a noisy rule gets switched off.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"
export async function acceptThing(token: string) {
  const session = await requireAuth()
  const [invite] = await db.select().from(thingsTable).where(eq(thingsTable.token, token)).limit(1)
  if (!invite) return { error: "not found" }
  await db.update(thingsTable).set({ status: "accepted" }).where(eq(thingsTable.id, invite.id))
  await logAudit({ actorId: session.user.id, action: "thing.accepted", targetId: invite.id })
  return { ok: true }
}
EOF
run "prior SELECT + guard PASSES" "$ACT_REL" 0

# 6. Existence proven via a query HELPER (actions/auth.ts loginAction) -> PASS.
cat > "$ACT_ABS" <<'EOF'
"use server"
// stop-verifier:public-action — pre-auth endpoint.
export async function loginThing(email: string) {
  const user = await getUserByEmail(email)
  if (!user) return { error: "bad credentials" }
  await db.update(usersTable).set({ failedLoginCount: 0 }).where(eq(usersTable.id, user.id))
  await logAudit({ actorId: user.id, action: "auth.login", targetId: user.id })
  return {}
}
EOF
run "helper SELECT + guard PASSES" "$ACT_REL" 0

# 7. Write with NO audit -> PASS (Rule 26 targets the forgery class only).
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAuth } from "@/lib/permissions"
export async function markAllRead() {
  const session = await requireAuth()
  await db.update(thingsTable).set({ readAt: new Date() }).where(eq(thingsTable.userId, session.user.id))
  return {}
}
EOF
run "write without audit PASSES" "$ACT_REL" 0

# 8. Explicit opt-out marker -> PASS.
cat > "$ACT_ABS" <<'EOF'
"use server"
import { requireAdmin } from "@/lib/permissions"
export async function sweepThings() {
  const session = await requireAdmin()
  // stop-verifier:rows-affected-ok — bulk sweep, zero rows is a normal outcome.
  await db.update(thingsTable).set({ archived: true }).where(lt(thingsTable.createdAt, cutoff))
  await logAudit({ actorId: session.user.id, action: "thing.swept" })
  return {}
}
EOF
run "opt-out marker PASSES" "$ACT_REL" 0

echo ""
echo "  Rule 26: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
