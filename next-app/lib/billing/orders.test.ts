/**
 * E327 — settleOrder() state-machine + idempotency tests.
 *
 * The DB is mocked (node env, no Postgres). We model the two seams settleOrder
 * relies on: the payment_events UNIQUE dedup (onConflictDoNothing → empty array
 * on a duplicate provider_event_id) and the pending-guarded order update
 * (`WHERE status = 'pending'` → count 0 once already paid).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vi.mock factories are hoisted above imports — build shared state via vi.hoisted
// so the factory can read it without a temporal-dead-zone error.
const state = vi.hoisted(() => ({
  seenEventIds: new Set<string>(),
  orderStatus: "pending" as "pending" | "paid" | "failed" | "refunded",
}))

vi.mock("@/lib/db", () => {
  const db = {
    insert() {
      // payment_events insert → onConflictDoNothing → returning
      return {
        values: (v: { providerEventId: string }) => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              if (state.seenEventIds.has(v.providerEventId)) return []
              state.seenEventIds.add(v.providerEventId)
              return [{ id: "pe_row" }]
            },
          }),
        }),
      }
    },
    update(table: { __t: string }) {
      return {
        set: (s: { status?: string }) => ({
          where: async () => {
            if (table.__t !== "orders") return { count: 1 } // markEventProcessed
            // Pending-guarded transition — fires at most once.
            if (state.orderStatus !== "pending") return { count: 0 }
            if (s.status === "paid") state.orderStatus = "paid"
            else if (s.status === "failed") state.orderStatus = "failed"
            return { count: 1 }
          },
        }),
      }
    },
  }
  return { db }
})

vi.mock("@/lib/schema", () => ({
  paymentEventsTable: { __t: "payment_events", providerEventId: "provider_event_id" },
  ordersTable: { __t: "orders", id: "id", status: "status" },
}))
vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ __eq: a }),
  and: (...a: unknown[]) => ({ __and: a }),
}))

import { settleOrder } from "./orders"

const ORDER_ID = "order-1"

beforeEach(() => {
  state.seenEventIds = new Set()
  state.orderStatus = "pending"
})
afterEach(() => vi.clearAllMocks())

function paidEvent(providerEventId: string) {
  return {
    provider: "ecpay",
    providerEventId,
    eventType: "ecpay.return.payment",
    orderId: ORDER_ID,
    providerOrderId: "trade_1",
    success: true as const,
  }
}

describe("settleOrder", () => {
  it("settles a pending order to paid exactly once", async () => {
    const r = await settleOrder(paidEvent("evt-1"))
    expect(r).toEqual({ settled: true, duplicate: false, status: "paid" })
    expect(state.orderStatus).toBe("paid")
  })

  it("a DUPLICATE webhook (same provider_event_id) is an idempotent no-op", async () => {
    const first = await settleOrder(paidEvent("evt-dup"))
    expect(first.settled).toBe(true)

    const second = await settleOrder(paidEvent("evt-dup"))
    expect(second).toEqual({ settled: false, duplicate: true, status: "skipped" })
    // Still exactly one paid transition.
    expect(state.orderStatus).toBe("paid")
  })

  it("a SECOND distinct event for an already-paid order does not re-settle", async () => {
    const first = await settleOrder(paidEvent("evt-a"))
    expect(first.settled).toBe(true)

    // Different event id → passes idempotency, but the pending guard blocks it.
    const second = await settleOrder(paidEvent("evt-b"))
    expect(second).toEqual({ settled: false, duplicate: false, status: "paid" })
    expect(state.orderStatus).toBe("paid")
  })

  it("marks a failed payment as failed (no paid transition)", async () => {
    const r = await settleOrder({
      provider: "ecpay",
      providerEventId: "evt-fail",
      eventType: "ecpay.return.payment",
      orderId: ORDER_ID,
      success: false,
    })
    expect(r).toEqual({ settled: false, duplicate: false, status: "failed" })
    expect(state.orderStatus).toBe("failed")
  })
})
