/**
 * rows-affected-audit.int.test.ts — E368.
 *
 * The bug: five owner-scoped mutations ran their UPDATE/DELETE, ignored the
 * rows-affected count, and wrote their audit row unconditionally. Because
 * Server Actions are public POST endpoints, ANY authenticated caller could pass
 * somebody else's resource id and inject a forged audit entry — attributed to
 * themselves, naming a resource they cannot touch — into the very compliance
 * surface E356/E359 had just hardened.
 *
 * `actions/items.ts` already did this correctly (its `result.count === 0` check
 * even carries a comment explaining why). The fix had been applied per-case
 * rather than to the pattern; these cases pin all five.
 *
 * Each test asserts BOTH halves:
 *   1. the action reports an error (no silent success), and
 *   2. `audit_log` gains ZERO rows — the assertion that actually catches the
 *      forgery, and the one a return-value-only test would miss.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  isPostgresReachable,
  seedUser,
  setupTestDb,
  teardownTestDb,
  truncateDomain,
  type TestDb,
} from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn(
    "⏭ SKIP next-app/test/int/rows-affected-audit.int.test.ts — no reachable Postgres.",
  )
}

let actorId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (actorId ? { user: { id: actorId } } : null),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const MISSING_ID = "00000000-0000-4000-8000-000000000000"

describe.skipIf(!reachable)("E368 — owner-scoped writes must not audit a no-op", () => {
  let tdb: TestDb
  let attacker: { id: string }
  let victim: { id: string }

  let revokeApiKey: typeof import("@/actions/api-keys").revokeApiKey
  let setWebhookActive: typeof import("@/actions/webhooks").setWebhookActive
  let deleteWebhook: typeof import("@/actions/webhooks").deleteWebhook
  let revokeInvitation: typeof import("@/actions/team").revokeInvitation
  let markRead: typeof import("@/actions/notifications").markRead
  let setUserRole: typeof import("@/actions/admin").setUserRole
  let deleteUser: typeof import("@/actions/admin").deleteUser
  let resetUserTotp: typeof import("@/actions/admin").resetUserTotp

  beforeAll(async () => {
    tdb = await setupTestDb()
    ;({ revokeApiKey } = await import("@/actions/api-keys"))
    ;({ setWebhookActive, deleteWebhook } = await import("@/actions/webhooks"))
    ;({ revokeInvitation } = await import("@/actions/team"))
    ;({ markRead } = await import("@/actions/notifications"))
    ;({ setUserRole, deleteUser, resetUserTotp } = await import("@/actions/admin"))
  })
  afterAll(async () => teardownTestDb())

  afterEach(async () => {
    await truncateDomain(["audit_log", "api_keys", "webhooks", "invitations", "notifications"])
  })

  beforeAll(async () => {
    victim = await seedUser({ email: "victim@e368.test", role: "admin" })
    attacker = await seedUser({ email: "attacker@e368.test", role: "admin" })
  })

  async function auditCount(): Promise<number> {
    const rows = await tdb.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_log`
    return rows[0].n
  }

  /** Run `fn` as the attacker and assert: error returned AND no audit row written. */
  async function expectNoOpIsRefused(
    fn: () => Promise<{ error?: string; success?: boolean } | void>,
  ) {
    actorId = attacker.id
    const before = await auditCount()
    const res = await fn()
    expect(res).toBeTruthy()
    expect((res as { error?: string }).error).toBeTruthy()
    expect(await auditCount()).toBe(before) // ← the forgery assertion
  }

  it("revokeApiKey — another user's key id", async () => {
    const [key] = await tdb.sql<{ id: string }[]>`
      INSERT INTO api_keys (user_id, name, prefix, hashed_key)
      VALUES (${victim.id}, 'victim key', 'sk_v', 'hash') RETURNING id`
    await expectNoOpIsRefused(() => revokeApiKey(key.id))
    // ...and the victim's key is genuinely untouched.
    const [row] = await tdb.sql<{ revoked_at: Date | null }[]>`
      SELECT revoked_at FROM api_keys WHERE id = ${key.id}`
    expect(row.revoked_at).toBeNull()
  })

  it("setWebhookActive — another user's webhook id", async () => {
    const [wh] = await tdb.sql<{ id: string }[]>`
      INSERT INTO webhooks (user_id, url, events, secret, active)
      VALUES (${victim.id}, 'https://v.example/h', ARRAY['*'], 's', true) RETURNING id`
    await expectNoOpIsRefused(() => setWebhookActive(wh.id, false))
    const [row] = await tdb.sql<{ active: boolean }[]>`
      SELECT active FROM webhooks WHERE id = ${wh.id}`
    expect(row.active).toBe(true)
  })

  it("deleteWebhook — another user's webhook id", async () => {
    const [wh] = await tdb.sql<{ id: string }[]>`
      INSERT INTO webhooks (user_id, url, events, secret, active)
      VALUES (${victim.id}, 'https://v.example/h2', ARRAY['*'], 's', true) RETURNING id`
    await expectNoOpIsRefused(() => deleteWebhook(wh.id))
    const rows = await tdb.sql`SELECT id FROM webhooks WHERE id = ${wh.id}`
    expect(rows.length).toBe(1)
  })

  it("revokeInvitation — an id that matches no PENDING invitation", async () => {
    await expectNoOpIsRefused(() => revokeInvitation(MISSING_ID))
  })

  it("markRead — another user's notification id", async () => {
    const [n] = await tdb.sql<{ id: string }[]>`
      INSERT INTO notifications (user_id, title, body)
      VALUES (${victim.id}, 't', 'b') RETURNING id`
    actorId = attacker.id
    const res = await markRead(n.id)
    expect(res?.error).toBeTruthy()
    const [row] = await tdb.sql<{ read_at: Date | null }[]>`
      SELECT read_at FROM notifications WHERE id = ${n.id}`
    expect(row.read_at).toBeNull()
  })

  /**
   * These three were NOT in the review findings — the Rule 26 scanner surfaced
   * them once it worked, along with webhooks.ts setSystemWebhookActive /
   * deleteSystemWebhook. That is the whole argument for building the rule
   * instead of patching the reported cases: the reported set was 4 of 8.
   */
  it("setUserRole — a userId that does not exist", async () => {
    await expectNoOpIsRefused(() => setUserRole(MISSING_ID, "editor"))
  })

  it("deleteUser — a userId that does not exist", async () => {
    await expectNoOpIsRefused(() => deleteUser(MISSING_ID))
  })

  it("resetUserTotp — a userId that does not exist", async () => {
    await expectNoOpIsRefused(() => resetUserTotp(MISSING_ID))
  })

  it("the legitimate owner path still works and DOES audit", async () => {
    const [key] = await tdb.sql<{ id: string }[]>`
      INSERT INTO api_keys (user_id, name, prefix, hashed_key)
      VALUES (${attacker.id}, 'own key', 'sk_o', 'hash') RETURNING id`
    actorId = attacker.id
    const before = await auditCount()
    const res = await revokeApiKey(key.id)
    expect(res.error).toBeUndefined()
    expect(await auditCount()).toBe(before + 1)
  })
})
