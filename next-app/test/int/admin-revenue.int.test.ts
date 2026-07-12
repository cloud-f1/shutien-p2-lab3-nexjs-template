/**
 * admin-revenue.int.test.ts — E331 admin console mutations against a REAL
 * throwaway Postgres DB. Covers the two acceptance criteria that need a live DB:
 *
 *   • 標記退款 → orders.status = 'refunded' + one audit_log row + the E328
 *     entitlement fails IMMEDIATELY (hasEntitlement flips to false) — the implicit
 *     revocation, no second toggle;
 *   • 重寄啟用信 is idempotent-by-guard — refused for an account that already has a
 *     password (no token minted), allowed + a token minted for an activation-pending
 *     account;
 *   • non-admin callers are blocked server-side (live role re-read), writing nothing.
 *
 * Follows the harness dynamic-import ordering trap: setupTestDb() (which sets
 * DATABASE_URL) runs in beforeAll BEFORE any module importing @/lib/db. auth() is
 * mocked to a mutable id so we can flip actor/role between cases; getLiveRole reads
 * the REAL seeded row, so the admin gate is exercised for real.
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
    "⏭ SKIP next-app/test/int/admin-revenue.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

// Mutable actor the auth() mock reads lazily — flipped per test to exercise the
// admin gate (getLiveRole reads the real seeded role for whatever id we set).
let currentUserId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
}))

// next/cache revalidatePath is a no-op outside a request scope; stub it.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

// Stub the mailer — never touch SMTP.
const sendActivationEmail = vi.fn(async (..._a: unknown[]) => {})
vi.mock("@/lib/email", () => ({
  sendActivationEmail: (...a: unknown[]) => sendActivationEmail(...a),
  sendReceiptEmail: vi.fn(async () => {}),
}))

describe.skipIf(!reachable)("E331 admin revenue console (int)", () => {
  let tdb: TestDb
  let markRefunded: typeof import("@/actions/admin-revenue").markRefunded
  let resendActivation: typeof import("@/actions/admin-revenue").resendActivation
  let hasEntitlement: typeof import("@/lib/entitlements").hasEntitlement

  const ENT_KEY = "course-x"

  beforeAll(async () => {
    tdb = await setupTestDb() // sets DATABASE_URL first
    ;({ markRefunded, resendActivation } = await import("@/actions/admin-revenue"))
    ;({ hasEntitlement } = await import("@/lib/entitlements"))
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    await truncateDomain([
      "audit_log",
      "payment_events",
      "orders",
      "products",
      "password_reset_tokens",
      "users",
    ])
    vi.clearAllMocks()
    currentUserId = null
  })

  async function seedAdmin(): Promise<string> {
    const admin = await seedUser({ email: "admin@int.test", role: "admin" })
    currentUserId = admin.id
    return admin.id
  }

  async function seedProduct(): Promise<string> {
    const rows = await tdb.sql<{ id: string }[]>`
      INSERT INTO products (slug, name, amount, currency, active, entitlement_key)
      VALUES ('course-x', 'Course X', 1000, 'TWD', true, ${ENT_KEY})
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

  it("標記退款: paid → refunded, writes one audit row, revokes the entitlement immediately", async () => {
    await seedAdmin()
    const productId = await seedProduct()
    const buyer = await seedUser({ email: "buyer@int.test", role: "viewer" })
    const orderId = await seedOrder(productId, "buyer@int.test", "paid", buyer.id)

    // Entitlement is live before the refund.
    expect(await hasEntitlement(buyer.id, ENT_KEY)).toBe(true)

    const res = await markRefunded(orderId)
    expect(res).toEqual({ success: true })

    const [order] = await tdb.sql<{ status: string }[]>`
      SELECT status FROM orders WHERE id = ${orderId}
    `
    expect(order.status).toBe("refunded")

    // Entitlement fails immediately — the E328 guard only counts `paid` orders.
    expect(await hasEntitlement(buyer.id, ENT_KEY)).toBe(false)

    // Exactly one audit row for the refund.
    const audit = await tdb.sql<{ action: string; target_id: string }[]>`
      SELECT action, target_id FROM audit_log WHERE action = 'order.refunded'
    `
    expect(audit).toHaveLength(1)
    expect(audit[0].target_id).toBe(orderId)
  })

  it("標記退款: rejects a non-paid order and a double refund (no extra audit rows)", async () => {
    await seedAdmin()
    const productId = await seedProduct()
    const pendingOrder = await seedOrder(productId, "p@int.test", "pending", null)

    expect(await markRefunded(pendingOrder)).toMatchObject({ error: expect.any(String) })

    const paidOrder = await seedOrder(productId, "q@int.test", "paid", null)
    expect(await markRefunded(paidOrder)).toEqual({ success: true })
    // Second refund on the same order is refused.
    expect(await markRefunded(paidOrder)).toMatchObject({ error: expect.any(String) })

    const audit = await tdb.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM audit_log WHERE action = 'order.refunded'
    `
    expect(audit[0].n).toBe(1)
  })

  it("非 admin 被 server-side 擋下 — no status change, no audit, no token", async () => {
    await seedAdmin()
    const productId = await seedProduct()
    const buyer = await seedUser({ email: "buyer2@int.test", role: "viewer" })
    const orderId = await seedOrder(productId, "buyer2@int.test", "paid", buyer.id)

    // Act AS the viewer (live role re-read denies).
    currentUserId = buyer.id
    expect(await markRefunded(orderId)).toMatchObject({ error: expect.any(String) })
    expect(await resendActivation(orderId)).toMatchObject({ error: expect.any(String) })

    const [order] = await tdb.sql<{ status: string }[]>`
      SELECT status FROM orders WHERE id = ${orderId}
    `
    expect(order.status).toBe("paid") // unchanged
    const audit = await tdb.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_log`
    expect(audit[0].n).toBe(0)
  })

  it("重寄啟用信: allowed for a no-password account — mints a token + sends the mail", async () => {
    await seedAdmin()
    const productId = await seedProduct()
    // Activation-pending buyer: real account, NO usable password.
    const buyer = await seedUser({
      email: "pending@int.test",
      role: "viewer",
      passwordHash: null,
    })
    const orderId = await seedOrder(productId, "pending@int.test", "paid", buyer.id)

    const res = await resendActivation(orderId)
    expect(res).toEqual({ success: true })

    const tokens = await tdb.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = ${buyer.id}
    `
    expect(tokens[0].n).toBe(1)
    expect(sendActivationEmail).toHaveBeenCalledTimes(1)

    const audit = await tdb.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM audit_log WHERE action = 'order.activation_resent'
    `
    expect(audit[0].n).toBe(1)
  })

  it("重寄啟用信: refused once the account has a password — no token, no mail", async () => {
    await seedAdmin()
    const productId = await seedProduct()
    const buyer = await seedUser({
      email: "set@int.test",
      role: "viewer",
      passwordHash: "$2a$existing-hash",
    })
    const orderId = await seedOrder(productId, "set@int.test", "paid", buyer.id)

    expect(await resendActivation(orderId)).toMatchObject({ error: expect.any(String) })

    const tokens = await tdb.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = ${buyer.id}
    `
    expect(tokens[0].n).toBe(0)
    expect(sendActivationEmail).not.toHaveBeenCalled()
  })
})
