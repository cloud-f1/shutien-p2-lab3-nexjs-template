/**
 * public-action-rate-limit.int.test.ts — E370.
 *
 * `createOneTimeCheckoutAction` is the ONE Server Action in this codebase
 * reachable with no session at all (`{ public: true }`). Before E370 it was
 * also the only action with no throttle of any kind: every authenticated action
 * carries a `rateLimitGuard(...)`, and `defineAction`'s public branch applied
 * none. An anonymous loop could insert unbounded `orders` rows (pending, with an
 * attacker-chosen customerEmail), burn gateway session quota, and drive one
 * `logAudit` write per hit.
 *
 * The fix is at the FACTORY level, not on this one action — so every future
 * public action inherits it. These cases pin both halves: the throttle fires,
 * and it is per-client rather than global.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { ONE_TIME_CHECKOUT_RATE_LIMIT } from "@/lib/billing/checkout-schema"

import { isPostgresReachable, setupTestDb, teardownTestDb, truncateDomain, type TestDb } from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn("⏭ SKIP next-app/test/int/public-action-rate-limit.int.test.ts — no reachable Postgres.")
}

vi.mock("@/lib/auth", () => ({ auth: async () => null })) // always anonymous
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

// Stub the gateway — this suite is about the throttle, not about Stripe.
const createCheckout = vi.fn(async () => ({ checkoutUrl: "https://checkout.example.com/s/abc" }))
vi.mock("@/lib/billing/resolver", () => ({
  resolveProviderKey: () => "stripe",
  resolveOneTime: async () => ({ createCheckout }),
}))

// The client IP the factory will see; each test drives this.
let currentIp = "203.0.113.1"
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name === "x-forwarded-for" ? currentIp : null),
  }),
}))

describe.skipIf(!reachable)("E370 — public actions are throttled by default", () => {
  let tdb: TestDb
  let createOneTimeCheckout: typeof import("@/actions/checkout").createOneTimeCheckout
  let __resetRateLimit: typeof import("@/lib/rate-limit").__resetRateLimit

  beforeAll(async () => {
    tdb = await setupTestDb()
    ;({ createOneTimeCheckout } = await import("@/actions/checkout"))
    ;({ __resetRateLimit } = await import("@/lib/rate-limit"))

    // One active product for the action to resolve.
    await tdb.sql`
      INSERT INTO products (slug, name, description, amount, currency, active)
      VALUES ('e370-product', 'E370 Product', null, 100, 'TWD', true)
      ON CONFLICT (slug) DO NOTHING`
  })
  afterAll(async () => teardownTestDb())

  beforeEach(() => {
    __resetRateLimit()
    currentIp = "203.0.113.1"
  })
  afterEach(async () => truncateDomain(["orders"]))

  async function orderCount(): Promise<number> {
    const rows = await tdb.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM orders`
    return rows[0].n
  }

  const call = () =>
    createOneTimeCheckout({ productSlug: "e370-product", email: "guest@e370.test" })

  it("AC1 — past the threshold the action is refused AND no order row is created", async () => {
    // Driven by the SAME constant the action uses (E375) — a tuning change can
    // no longer silently turn this assertion into a no-op.
    let refusedAt = -1
    for (let i = 0; i < ONE_TIME_CHECKOUT_RATE_LIMIT.limit + 5; i++) {
      const res = await call()
      if ("error" in res && res.error && /稍後|次數|頻繁|請稍/.test(res.error)) {
        refusedAt = i
        break
      }
    }
    expect(refusedAt).toBeGreaterThanOrEqual(0)
    const countAtRefusal = await orderCount()

    // Further calls must not grow the table.
    await call()
    await call()
    expect(await orderCount()).toBe(countAtRefusal)
  })

  it("AC2 — the limit is per client IP, not one global bucket", async () => {
    const throttled = (r: Awaited<ReturnType<typeof call>>) =>
      "error" in r && /稍後|次數|頻繁|請稍/.test(r.error ?? "")

    for (let i = 0; i < ONE_TIME_CHECKOUT_RATE_LIMIT.limit + 2; i++) await call()

    // First half of the claim: client A IS now throttled. Without this the test
    // passes trivially when NO throttle exists at all — it would assert only
    // that an unthrottled client is unthrottled. (Verified: with the factory
    // change reverted, this expectation is what turns the case red.)
    expect(throttled(await call())).toBe(true)
    const afterFirstClient = await orderCount()

    // Second half: a different client still has a fresh budget.
    currentIp = "198.51.100.7"
    expect(throttled(await call())).toBe(false)
    expect(await orderCount()).toBeGreaterThan(afterFirstClient)
  })
})
