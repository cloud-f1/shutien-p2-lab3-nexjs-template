/**
 * entitlements.int.test.ts — E328 against a REAL throwaway Postgres DB.
 *
 * Covers the server-side ownership guard + the settleOrder() delivery pipeline
 * end-to-end (real db, real auto-provision; only @/lib/email is stubbed so no SMTP
 * is needed):
 *   • hasEntitlement blocks a non-owner and a pending (unpaid) order — this is the
 *     exact mechanism the gated /dashboard/library/[slug] page uses to block
 *     direct-URL access without a paid order;
 *   • a NEW-email paid settlement auto-provisions a NO-password account, links the
 *     order, issues a reset/activation token, and grants a live entitlement;
 *   • an EXISTING-email paid settlement links only — no new account, no token;
 *   • settlement survives a mail failure (best-effort delivery).
 *
 * Follows the harness dynamic-import ordering trap: setupTestDb() (which sets
 * DATABASE_URL) runs in beforeAll BEFORE any module that imports @/lib/db.
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
    "⏭ SKIP next-app/test/int/entitlements.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

// Stub the mailer — never touch SMTP in tests. One case overrides to reject to
// prove settlement survives a mail failure.
const sendActivationEmail = vi.fn(async (..._a: unknown[]) => {})
const sendReceiptEmail = vi.fn(async (..._a: unknown[]) => {})
vi.mock("@/lib/email", () => ({
  sendActivationEmail: (...a: unknown[]) => sendActivationEmail(...a),
  sendReceiptEmail: (...a: unknown[]) => sendReceiptEmail(...a),
}))

describe.skipIf(!reachable)("E328 entitlements + delivery (int)", () => {
  let tdb: TestDb
  let settleOrder: typeof import("@/lib/billing/orders").settleOrder
  let hasEntitlement: typeof import("@/lib/entitlements").hasEntitlement
  let getEntitledProducts: typeof import("@/lib/entitlements").getEntitledProducts

  const ENT_KEY = "course-x"

  beforeAll(async () => {
    tdb = await setupTestDb() // sets DATABASE_URL first
    ;({ settleOrder } = await import("@/lib/billing/orders"))
    ;({ hasEntitlement, getEntitledProducts } = await import("@/lib/entitlements"))
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    await truncateDomain(["payment_events", "orders", "products", "password_reset_tokens", "users"])
    vi.clearAllMocks()
  })

  async function seedProduct(slug: string, entitlementKey: string | null): Promise<string> {
    const rows = await tdb.sql<{ id: string }[]>`
      INSERT INTO products (slug, name, amount, currency, active, entitlement_key)
      VALUES (${slug}, ${slug}, 1000, 'TWD', true, ${entitlementKey})
      RETURNING id
    `
    return rows[0].id
  }

  async function seedOrder(
    productId: string,
    email: string,
    status: "pending" | "paid",
    userId: string | null,
  ): Promise<string> {
    const rows = await tdb.sql<{ id: string }[]>`
      INSERT INTO orders (product_id, user_id, customer_email, provider, amount, currency, status, paid_at)
      VALUES (${productId}, ${userId}, ${email}, 'ecpay', 1000, 'TWD', ${status},
              ${status === "paid" ? tdb.sql`now()` : null})
      RETURNING id
    `
    return rows[0].id
  }

  it("hasEntitlement blocks a non-owner and an unpaid (pending) order", async () => {
    const productId = await seedProduct("course-x", ENT_KEY)
    const owner = await seedUser({ email: "owner@int.test", role: "viewer" })
    const stranger = await seedUser({ email: "stranger@int.test", role: "viewer" })

    // Owner has only a PENDING order → not entitled yet (guard blocks direct access).
    await seedOrder(productId, "owner@int.test", "pending", owner.id)
    expect(await hasEntitlement(owner.id, ENT_KEY)).toBe(false)
    // A stranger with no order at all → blocked.
    expect(await hasEntitlement(stranger.id, ENT_KEY)).toBe(false)

    // Flip to paid → entitlement is live on the next read.
    await tdb.sql`UPDATE orders SET status = 'paid', paid_at = now() WHERE user_id = ${owner.id}`
    expect(await hasEntitlement(owner.id, ENT_KEY)).toBe(true)
    // Still blocked for the stranger — ownership is per-user.
    expect(await hasEntitlement(stranger.id, ENT_KEY)).toBe(false)
  })

  it("new-email paid settlement auto-provisions a NO-password account + live entitlement", async () => {
    const productId = await seedProduct("course-x", ENT_KEY)
    const orderId = await seedOrder(productId, "new-buyer@int.test", "pending", null)

    const result = await settleOrder({
      provider: "ecpay",
      providerEventId: "evt-new-1",
      eventType: "ecpay.return.payment",
      orderId,
      success: true,
    })

    expect(result).toEqual({ settled: true, duplicate: false, status: "paid", isNewUser: true })

    // A user was created for the purchase email…
    const users = await tdb.sql<{ id: string; password_hash: string | null }[]>`
      SELECT id, password_hash FROM users WHERE email = 'new-buyer@int.test'
    `
    expect(users).toHaveLength(1)
    // …with NO usable password (never a plaintext/random one).
    expect(users[0].password_hash).toBeNull()

    // The order is linked to that user.
    const [order] = await tdb.sql<{ user_id: string | null }[]>`
      SELECT user_id FROM orders WHERE id = ${orderId}
    `
    expect(order.user_id).toBe(users[0].id)

    // An activation (reset) token was issued (E290 infra reuse).
    const tokens = await tdb.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = ${users[0].id}
    `
    expect(tokens[0].n).toBe(1)

    // The activation email fired; the entitlement is live.
    expect(sendActivationEmail).toHaveBeenCalledTimes(1)
    expect(await hasEntitlement(users[0].id, ENT_KEY)).toBe(true)

    const owned = await getEntitledProducts(users[0].id)
    expect(owned.map((p) => p.slug)).toContain("course-x")
  })

  it("existing-email paid settlement links only — no new account, no token", async () => {
    const productId = await seedProduct("course-x", ENT_KEY)
    const existing = await seedUser({
      email: "known@int.test",
      role: "viewer",
      passwordHash: "$2a$existing-hash",
    })
    const orderId = await seedOrder(productId, "known@int.test", "pending", null)

    const result = await settleOrder({
      provider: "ecpay",
      providerEventId: "evt-existing-1",
      eventType: "ecpay.return.payment",
      orderId,
      success: true,
    })

    expect(result.isNewUser).toBe(false)
    expect(result.settled).toBe(true)

    // Exactly one user with that email — no duplicate account.
    const users = await tdb.sql<{ id: string; password_hash: string | null }[]>`
      SELECT id, password_hash FROM users WHERE email = 'known@int.test'
    `
    expect(users).toHaveLength(1)
    expect(users[0].id).toBe(existing.id)
    // Their existing password hash is untouched.
    expect(users[0].password_hash).toBe("$2a$existing-hash")

    // Linked, receipt email sent, NO activation token minted.
    const [order] = await tdb.sql<{ user_id: string | null }[]>`
      SELECT user_id FROM orders WHERE id = ${orderId}
    `
    expect(order.user_id).toBe(existing.id)
    expect(sendReceiptEmail).toHaveBeenCalledTimes(1)

    const tokens = await tdb.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = ${existing.id}
    `
    expect(tokens[0].n).toBe(0)
  })

  it("settlement survives a mail failure (best-effort delivery)", async () => {
    sendActivationEmail.mockRejectedValueOnce(new Error("smtp down"))
    const productId = await seedProduct("course-x", ENT_KEY)
    const orderId = await seedOrder(productId, "mailfail@int.test", "pending", null)

    const result = await settleOrder({
      provider: "ecpay",
      providerEventId: "evt-mailfail-1",
      eventType: "ecpay.return.payment",
      orderId,
      success: true,
    })

    // Mail blew up, but the order is paid, linked, and isNewUser is correct.
    expect(result).toEqual({ settled: true, duplicate: false, status: "paid", isNewUser: true })
    const [order] = await tdb.sql<{ status: string; user_id: string | null }[]>`
      SELECT status, user_id FROM orders WHERE id = ${orderId}
    `
    expect(order.status).toBe("paid")
    expect(order.user_id).not.toBeNull()
  })
})
