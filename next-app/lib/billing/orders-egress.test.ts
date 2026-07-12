/**
 * E330 — settleOrder() CRM egress (`order.completed`) tests. Complements
 * orders.test.ts (state machine) + settle-delivery.test.ts (entitlement) by
 * locking the egress contract:
 *   • a single pending→paid transition emits `order.completed` EXACTLY once,
 *     with the PRD payload shape (incl. isNewUser);
 *   • a DUPLICATE gateway webhook (same provider_event_id) emits NOTHING;
 *   • a second distinct event for an already-paid order emits NOTHING;
 *   • a FAILED payment emits NOTHING;
 *   • a dispatch failure NEVER fails settlement.
 *
 * @/lib/webhooks is mocked so we assert on dispatchSystemEvent without real HTTP.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  seenEventIds: new Set<string>(),
  orderStatus: "pending" as "pending" | "paid" | "failed",
  orderRow: {
    customerEmail: "buyer@example.com",
    customerName: "Buyer",
    userId: null as string | null,
    productName: "Course",
    amount: 149900,
    currency: "TWD",
    provider: "ecpay",
  },
  provision: { userId: "u-new", isNewUser: true, activationToken: "tok" as string | null },
}))

vi.mock("@/lib/db", () => {
  const db = {
    insert() {
      return {
        values: (v: { providerEventId: string }) => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              if (state.seenEventIds.has(v.providerEventId)) return []
              state.seenEventIds.add(v.providerEventId)
              return [{ id: "pe" }]
            },
          }),
        }),
      }
    },
    update(table: { __t: string }) {
      return {
        set: (s: { status?: string }) => ({
          where: async () => {
            if (table.__t !== "orders") return { count: 1 }
            if (s.status === "paid") {
              if (state.orderStatus !== "pending") return { count: 0 }
              state.orderStatus = "paid"
              return { count: 1 }
            }
            if (s.status === "failed") {
              if (state.orderStatus !== "pending") return { count: 0 }
              state.orderStatus = "failed"
              return { count: 1 }
            }
            return { count: 1 }
          },
        }),
      }
    },
    select() {
      return {
        from: () => ({
          innerJoin: () => ({
            where: () => ({ limit: async () => [state.orderRow] }),
          }),
        }),
      }
    },
  }
  return { db }
})

vi.mock("@/lib/schema", () => ({
  paymentEventsTable: { __t: "payment_events", providerEventId: "provider_event_id" },
  ordersTable: { __t: "orders", id: "id", status: "status", productId: "product_id" },
  productsTable: { __t: "products", id: "id" },
}))
vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ __eq: a }),
  and: (...a: unknown[]) => ({ __and: a }),
}))
vi.mock("@/lib/auth-provision", () => ({
  provisionUserForOrder: async () => state.provision,
}))
vi.mock("@/lib/email", () => ({
  sendActivationEmail: async () => {},
  sendReceiptEmail: async () => {},
}))

const dispatchSystemEvent = vi.fn(async (..._a: unknown[]) => 1)
vi.mock("@/lib/webhooks", () => ({
  dispatchSystemEvent: (...a: unknown[]) => dispatchSystemEvent(...a),
}))

import { settleOrder } from "./orders"

function paidEvent(id: string) {
  return {
    provider: "ecpay",
    providerEventId: id,
    eventType: "ecpay.return.payment",
    orderId: "order-1",
    providerOrderId: "trade_1",
    success: true as const,
  }
}

beforeEach(() => {
  state.seenEventIds = new Set()
  state.orderStatus = "pending"
  state.orderRow = {
    customerEmail: "buyer@example.com",
    customerName: "Buyer",
    userId: null,
    productName: "Course",
    amount: 149900,
    currency: "TWD",
    provider: "ecpay",
  }
  state.provision = { userId: "u-new", isNewUser: true, activationToken: "tok" }
})
afterEach(() => vi.clearAllMocks())

describe("settleOrder CRM egress (E330)", () => {
  it("emits order.completed exactly once on the pending→paid transition", async () => {
    const r = await settleOrder(paidEvent("evt-1"))
    expect(r.settled).toBe(true)
    expect(dispatchSystemEvent).toHaveBeenCalledTimes(1)

    const [event, payload] = dispatchSystemEvent.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(event).toBe("order.completed")
    expect(payload).toMatchObject({
      orderId: "order-1",
      amount: 149900,
      currency: "TWD",
      productName: "Course",
      gateway: "ecpay",
      customer: { email: "buyer@example.com", name: "Buyer", phone: null, isNewUser: true },
    })
  })

  it("carries isNewUser=false for an existing buyer", async () => {
    state.provision = { userId: "u-existing", isNewUser: false, activationToken: null }
    await settleOrder(paidEvent("evt-2"))
    const [, payload] = dispatchSystemEvent.mock.calls[0] as [string, Record<string, unknown>]
    expect((payload.customer as { isNewUser: boolean }).isNewUser).toBe(false)
  })

  it("a DUPLICATE gateway webhook emits nothing (exactly-once)", async () => {
    await settleOrder(paidEvent("evt-dup"))
    dispatchSystemEvent.mockClear()

    const second = await settleOrder(paidEvent("evt-dup"))
    expect(second.duplicate).toBe(true)
    expect(dispatchSystemEvent).not.toHaveBeenCalled()
  })

  it("a second distinct event for an already-paid order emits nothing", async () => {
    await settleOrder(paidEvent("evt-a"))
    dispatchSystemEvent.mockClear()

    const second = await settleOrder(paidEvent("evt-b"))
    expect(second.settled).toBe(false)
    expect(dispatchSystemEvent).not.toHaveBeenCalled()
  })

  it("a FAILED payment emits nothing", async () => {
    await settleOrder({
      provider: "ecpay",
      providerEventId: "evt-fail",
      eventType: "ecpay.return.payment",
      orderId: "order-1",
      success: false,
    })
    expect(dispatchSystemEvent).not.toHaveBeenCalled()
  })

  it("a dispatch failure never fails settlement", async () => {
    dispatchSystemEvent.mockRejectedValueOnce(new Error("egress boom"))
    const r = await settleOrder(paidEvent("evt-boom"))
    expect(r).toEqual({ settled: true, duplicate: false, status: "paid", isNewUser: true })
    expect(state.orderStatus).toBe("paid")
  })
})
