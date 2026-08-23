/**
 * checkout.int.test.ts — actions/checkout.ts wiring against a REAL throwaway
 * Postgres DB (E349). `createOneTimeCheckout` is a DELIBERATE public action
 * (`// stop-verifier:public-action` in the source) — the safety property here
 * is the OPPOSITE of the other 6 files: it must be callable without a session,
 * and the amount/currency it charges must be entirely server-owned (read from
 * the `products` row), never taken from caller input.
 *
 * `@/lib/billing/resolver` is mocked so no real Stripe/ECPay adapter is
 * exercised (network/SDK boundary) — the checkout URL it returns is a stub;
 * the ORDER ROW is what we assert against.
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
    "⏭ SKIP next-app/test/int/checkout.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

let actorId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (actorId ? { user: { id: actorId } } : null),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const createCheckout = vi.fn(async () => ({ checkoutUrl: "https://checkout.example.com/session/abc" }))
vi.mock("@/lib/billing/resolver", () => ({
  resolveProviderKey: () => "stripe",
  resolveOneTime: async () => ({ createCheckout }),
}))

async function seedProduct(
  tdb: TestDb,
  slug: string,
  opts: { active?: boolean; amount?: number; currency?: string } = {},
): Promise<string> {
  const rows = await tdb.sql<{ id: string }[]>`
    INSERT INTO products (slug, name, amount, currency, active)
    VALUES (
      ${slug}, ${`Product ${slug}`},
      ${opts.amount ?? 1000}, ${opts.currency ?? "TWD"}, ${opts.active ?? true}
    )
    RETURNING id
  `
  return rows[0].id
}

describe.skipIf(!reachable)("actions/checkout.ts — createOneTimeCheckout (public action, int)", () => {
  let tdb: TestDb
  let checkout: typeof import("@/actions/checkout")

  beforeAll(async () => {
    tdb = await setupTestDb()
    checkout = await import("@/actions/checkout")
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    createCheckout.mockClear()
    await truncateDomain(["audit_log", "orders", "products", "users"])
  })

  it("IS callable with no session (guest checkout) — order created with user_id null", async () => {
    actorId = null
    await seedProduct(tdb, "guest-product")

    const result = await checkout.createOneTimeCheckout({
      productSlug: "guest-product",
      email: "guest@int.test",
    })
    expect(result).toMatchObject({ ok: true })
    if (!("ok" in result)) throw new Error("unreachable")

    const rows = await tdb.sql<{ user_id: string | null; customer_email: string }[]>`
      SELECT user_id, customer_email FROM orders WHERE id = ${result.orderId}
    `
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBeNull()
    expect(rows[0].customer_email).toBe("guest@int.test")
  })

  it("a logged-in buyer's order is linked to their user id", async () => {
    const buyer = await seedUser({ email: "buyer@int.test", role: "viewer" })
    actorId = buyer.id
    await seedProduct(tdb, "buyer-product")

    const result = await checkout.createOneTimeCheckout({
      productSlug: "buyer-product",
      email: "buyer@int.test",
    })
    if (!("ok" in result)) throw new Error("unreachable")

    const rows = await tdb.sql<{ user_id: string | null }[]>`
      SELECT user_id FROM orders WHERE id = ${result.orderId}
    `
    expect(rows[0].user_id).toBe(buyer.id)
  })

  it("SECURITY: amount/currency are server-owned — a forged client amount/currency is ignored", async () => {
    actorId = null
    await seedProduct(tdb, "priced-product", { amount: 4990, currency: "TWD" })

    // Simulate a malicious/stale client still POSTing extra fields the schema
    // doesn't declare — Zod strips unknown keys, so these must have zero effect.
    const forged = {
      productSlug: "priced-product",
      email: "forger@int.test",
      amount: 1, // attacker wants to pay 1 cent
      currency: "USD", // attacker wants a different currency entirely
    }
    const result = await checkout.createOneTimeCheckout(
      forged as unknown as Parameters<typeof checkout.createOneTimeCheckout>[0],
    )
    if (!("ok" in result)) throw new Error("unreachable")

    const rows = await tdb.sql<{ amount: number; currency: string }[]>`
      SELECT amount, currency FROM orders WHERE id = ${result.orderId}
    `
    expect(rows[0].amount).toBe(4990) // from the product row, not the forged "1"
    expect(rows[0].currency).toBe("TWD") // from the product row, not the forged "USD"

    // The gateway is asked to charge the SERVER's amount/currency, not the client's.
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4990, currency: "TWD" }),
    )
  })

  it("an inactive/nonexistent product is refused before any order is written", async () => {
    actorId = null
    await seedProduct(tdb, "inactive-product", { active: false })

    const result = await checkout.createOneTimeCheckout({
      productSlug: "inactive-product",
      email: "someone@int.test",
    })
    expect(result).toMatchObject({ error: expect.any(String) })

    const rows = await tdb.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM orders`
    expect(rows[0].n).toBe(0)
  })
})
