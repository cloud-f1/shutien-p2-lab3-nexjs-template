/**
 * E274 — checkout + cancel server-action integration tests.
 *
 * The action imports @/lib/db (throws without DATABASE_URL), so we mock the DB
 * layer, the auth guard, the plan resolver, and the provider — exercising the
 * action's ORCHESTRATION (FK resolution → metadata.planUuid → audit) without a
 * real database or gateway.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks (declared before importing the SUT) -----------------------------

const mockRequireAuth = vi.fn()
vi.mock("@/lib/permissions", () => ({
  requireAuth: () => mockRequireAuth(),
}))

const mockLogAudit = vi.fn()
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}))

const mockResolveOrCreatePlanId = vi.fn()
vi.mock("@/lib/billing/plans", () => ({
  resolveOrCreatePlanId: (...args: unknown[]) => mockResolveOrCreatePlanId(...args),
}))

const mockCreateCheckout = vi.fn()
const mockCancelSubscription = vi.fn()
const mockResolveProviderKey = vi.fn(() => "stripe")
vi.mock("@/lib/billing/resolver", () => ({
  resolvePaymentProvider: async () => ({
    createCheckout: (...a: unknown[]) => mockCreateCheckout(...a),
    cancelSubscription: (...a: unknown[]) => mockCancelSubscription(...a),
  }),
  resolveProviderKey: () => mockResolveProviderKey(),
}))

// getActiveSubscription — used by createPortalSession to resolve the customer id.
const mockGetActiveSubscription = vi.fn()
vi.mock("@/lib/billing/queries", () => ({
  getActiveSubscription: (...a: unknown[]) => mockGetActiveSubscription(...a),
}))

// Stripe SDK client — only billingPortal.sessions.create is exercised here.
const mockPortalCreate = vi.fn()
vi.mock("@/lib/billing/providers/stripe", () => ({
  getStripeClient: () => ({
    billingPortal: { sessions: { create: (...a: unknown[]) => mockPortalCreate(...a) } },
  }),
}))

// next/headers — provide a request origin for the return_url.
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => (k === "origin" ? "https://app.example.com" : null) }),
}))

// DB mock — a tiny chainable builder for select/update used by cancelSubscription.
const dbState: { subRow: Record<string, unknown> | null; updated: unknown } = {
  subRow: null,
  updated: null,
}
vi.mock("@/lib/db", () => {
  const select = () => ({
    from: () => ({
      where: () => ({
        limit: async () => (dbState.subRow ? [dbState.subRow] : []),
      }),
    }),
  })
  const update = () => ({
    set: (vals: unknown) => ({
      where: async () => {
        dbState.updated = vals
        return []
      },
    }),
  })
  return { db: { select, update } }
})

vi.mock("@/lib/schema", () => ({ subscriptionsTable: { id: "id", userId: "user_id" } }))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// drizzle eq() — just return a marker
vi.mock("drizzle-orm", () => ({ eq: (...a: unknown[]) => ({ __eq: a }) }))

// --- Import the SUT after mocks --------------------------------------------

import { cancelSubscription, createCheckoutSession, createPortalSession } from "./billing"

beforeEach(() => {
  vi.clearAllMocks()
  dbState.subRow = null
  dbState.updated = null
  mockRequireAuth.mockResolvedValue({ user: { id: "user_1", email: "u@example.com" } })
  mockResolveProviderKey.mockReturnValue("stripe")
})

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

describe("createCheckoutSession", () => {
  it("resolves the plan UUID and carries it as planUuid into the provider", async () => {
    mockResolveOrCreatePlanId.mockResolvedValue("uuid-pro-123")
    mockCreateCheckout.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com/x",
      sessionId: "cs_1",
    })

    const res = await createCheckoutSession(
      "price_pro_demo",
      "https://app/success",
      "https://app/cancel",
    )

    expect(res.success).toBe(true)
    expect(res.checkoutUrl).toBe("https://checkout.stripe.com/x")
    // FK fix: the plans.id UUID is carried in planUuid (not the providerPriceId).
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "price_pro_demo", // stripe gateway price id
        planUuid: "uuid-pro-123",
        userId: "user_1",
      }),
    )
    // Audit records the checkout start with the resolved plan UUID.
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "billing.checkout_started",
        targetId: "uuid-pro-123",
      }),
    )
  })

  it("rejects an unknown providerPriceId (not in config)", async () => {
    const res = await createCheckoutSession("price_nope", "s", "c")
    expect(res.success).toBe(false)
    expect(mockResolveOrCreatePlanId).not.toHaveBeenCalled()
  })

  it("rejects an empty providerPriceId", async () => {
    const res = await createCheckoutSession("", "s", "c")
    expect(res.success).toBe(false)
    expect(res.error).toContain("無效")
  })

  it("surfaces a provider error as a failed result", async () => {
    mockResolveOrCreatePlanId.mockResolvedValue("uuid-pro-123")
    mockCreateCheckout.mockRejectedValue(new Error("gateway down"))
    const res = await createCheckoutSession("price_pro_demo", "s", "c")
    expect(res.success).toBe(false)
    expect(res.error).toContain("gateway down")
  })
})

// ---------------------------------------------------------------------------
// cancelSubscription
// ---------------------------------------------------------------------------

describe("cancelSubscription", () => {
  it("cancels an owned subscription at period end and persists the status", async () => {
    dbState.subRow = {
      id: "sub_db_1",
      userId: "user_1",
      provider: "stripe",
      providerSubId: "sub_stripe_1",
      status: "active",
      cancelAt: null,
    }
    mockCancelSubscription.mockResolvedValue({
      id: "sub_db_1",
      status: "active",
      cancelAt: 1_700_000_000,
    })

    const res = await cancelSubscription("sub_db_1")

    expect(res.success).toBe(true)
    expect(mockCancelSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ providerSubId: "sub_stripe_1", atPeriodEnd: true }),
    )
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "billing.subscription_canceled" }),
    )
    // The DB update set the cancelAt from the provider result.
    expect((dbState.updated as { cancelAt: Date }).cancelAt).toBeInstanceOf(Date)
  })

  it("refuses to cancel a subscription the caller does not own", async () => {
    dbState.subRow = {
      id: "sub_db_2",
      userId: "someone_else",
      provider: "stripe",
      providerSubId: "sub_stripe_2",
      status: "active",
      cancelAt: null,
    }
    const res = await cancelSubscription("sub_db_2")
    expect(res.success).toBe(false)
    expect(res.error).toContain("沒有權限")
    expect(mockCancelSubscription).not.toHaveBeenCalled()
  })

  it("returns an error when the subscription does not exist", async () => {
    dbState.subRow = null
    const res = await cancelSubscription("missing")
    expect(res.success).toBe(false)
    expect(mockCancelSubscription).not.toHaveBeenCalled()
  })

  it("refuses to re-cancel an already-canceled subscription", async () => {
    dbState.subRow = {
      id: "sub_db_3",
      userId: "user_1",
      provider: "stripe",
      providerSubId: "sub_stripe_3",
      status: "canceled",
      cancelAt: null,
    }
    const res = await cancelSubscription("sub_db_3")
    expect(res.success).toBe(false)
    expect(res.error).toContain("已取消")
  })

  it("validates the subscription id", async () => {
    const res = await cancelSubscription("")
    expect(res.success).toBe(false)
    expect(res.error).toContain("無效")
  })
})

// ---------------------------------------------------------------------------
// createPortalSession (E292)
// ---------------------------------------------------------------------------

describe("createPortalSession", () => {
  it("opens a Stripe portal with the owner's customer id + computed return_url", async () => {
    mockGetActiveSubscription.mockResolvedValue({
      subscription: { id: "sub_db_1", providerMeta: { customer: "cus_abc" } },
      plan: { id: "plan_1" },
    })
    mockPortalCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/session_xyz" })

    const res = await createPortalSession()

    expect(res.success).toBe(true)
    expect(res.url).toBe("https://billing.stripe.com/p/session_xyz")
    // Argument shape: customer comes from the subscription, return_url from origin.
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_abc",
      return_url: "https://app.example.com/dashboard/system",
    })
    // The portal open is audited against the owned subscription.
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "billing.portal_opened", targetId: "sub_db_1" }),
    )
  })

  it("refuses non-Stripe providers with a clear unsupported message", async () => {
    mockResolveProviderKey.mockReturnValue("ecpay")
    const res = await createPortalSession()
    expect(res.success).toBe(false)
    expect(res.error).toContain("不支援")
    expect(mockGetActiveSubscription).not.toHaveBeenCalled()
    expect(mockPortalCreate).not.toHaveBeenCalled()
  })

  it("returns an error when the user has no active subscription", async () => {
    mockGetActiveSubscription.mockResolvedValue(null)
    const res = await createPortalSession()
    expect(res.success).toBe(false)
    expect(mockPortalCreate).not.toHaveBeenCalled()
  })

  it("returns an error when the subscription has no Stripe customer id", async () => {
    mockGetActiveSubscription.mockResolvedValue({
      subscription: { id: "sub_db_2", providerMeta: { stripe_status: "active" } },
      plan: { id: "plan_1" },
    })
    const res = await createPortalSession()
    expect(res.success).toBe(false)
    expect(res.error).toContain("找不到")
    expect(mockPortalCreate).not.toHaveBeenCalled()
  })

  it("surfaces a Stripe error as a failed result", async () => {
    mockGetActiveSubscription.mockResolvedValue({
      subscription: { id: "sub_db_3", providerMeta: { customer: "cus_abc" } },
      plan: { id: "plan_1" },
    })
    mockPortalCreate.mockRejectedValue(new Error("portal down"))
    const res = await createPortalSession()
    expect(res.success).toBe(false)
    expect(res.error).toContain("portal down")
  })
})
