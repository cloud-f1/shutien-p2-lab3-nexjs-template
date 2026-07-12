/**
 * E328 — settleOrder() post-paid delivery orchestration (db/provision/email
 * mocked). Complements orders.test.ts (the state machine) by locking the delivery
 * contract:
 *   • a NEW-email buyer → account linked + activation email + isNewUser true;
 *   • an EXISTING buyer → linked + receipt email + isNewUser false;
 *   • a MAIL failure NEVER fails settlement and NEVER flips isNewUser;
 *   • a PROVISION failure NEVER fails settlement (settle already committed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  orderStatus: "pending" as "pending" | "paid",
  orderRow: {
    customerEmail: "buyer@example.com",
    customerName: "Buyer",
    userId: null as string | null,
    productName: "Course",
  },
  linkedUserId: null as string | null,
  provision: {
    userId: "u-new",
    isNewUser: true,
    activationToken: "tok-123" as string | null,
  },
  provisionThrows: false,
}))

vi.mock("@/lib/db", () => {
  const db = {
    insert() {
      return {
        values: () => ({
          onConflictDoNothing: () => ({ returning: async () => [{ id: "pe" }] }),
        }),
      }
    },
    update(table: { __t: string }) {
      return {
        set: (s: { status?: string; userId?: string }) => ({
          where: async () => {
            if (table.__t !== "orders") return { count: 1 } // markEventProcessed
            if (s.status === "paid") {
              if (state.orderStatus !== "pending") return { count: 0 }
              state.orderStatus = "paid"
              return { count: 1 }
            }
            if (s.userId !== undefined) {
              state.linkedUserId = s.userId
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
  provisionUserForOrder: async () => {
    if (state.provisionThrows) throw new Error("provision boom")
    return state.provision
  },
}))

const sendActivationEmail = vi.fn(async (..._a: unknown[]) => {})
const sendReceiptEmail = vi.fn(async (..._a: unknown[]) => {})
vi.mock("@/lib/email", () => ({
  sendActivationEmail: (...a: unknown[]) => sendActivationEmail(...a),
  sendReceiptEmail: (...a: unknown[]) => sendReceiptEmail(...a),
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
  state.orderStatus = "pending"
  state.orderRow = {
    customerEmail: "buyer@example.com",
    customerName: "Buyer",
    userId: null,
    productName: "Course",
  }
  state.linkedUserId = null
  state.provision = { userId: "u-new", isNewUser: true, activationToken: "tok-123" }
  state.provisionThrows = false
})
afterEach(() => vi.clearAllMocks())

describe("settleOrder delivery (E328)", () => {
  it("new buyer → links the new account, sends activation, reports isNewUser", async () => {
    const r = await settleOrder(paidEvent("e1"))
    expect(r).toEqual({ settled: true, duplicate: false, status: "paid", isNewUser: true })
    expect(state.linkedUserId).toBe("u-new")
    expect(sendActivationEmail).toHaveBeenCalledTimes(1)
    expect(sendReceiptEmail).not.toHaveBeenCalled()
  })

  it("existing buyer → links, sends receipt, isNewUser false", async () => {
    state.provision = { userId: "u-existing", isNewUser: false, activationToken: null }
    const r = await settleOrder(paidEvent("e2"))
    expect(r.isNewUser).toBe(false)
    expect(r.settled).toBe(true)
    expect(state.linkedUserId).toBe("u-existing")
    expect(sendReceiptEmail).toHaveBeenCalledTimes(1)
    expect(sendActivationEmail).not.toHaveBeenCalled()
  })

  it("a mail failure NEVER fails settlement and preserves isNewUser", async () => {
    sendActivationEmail.mockRejectedValueOnce(new Error("smtp down"))
    const r = await settleOrder(paidEvent("e3"))
    expect(r).toEqual({ settled: true, duplicate: false, status: "paid", isNewUser: true })
    // Account was still linked even though the mail blew up.
    expect(state.linkedUserId).toBe("u-new")
  })

  it("a provisioning failure NEVER fails settlement (isNewUser false)", async () => {
    state.provisionThrows = true
    const r = await settleOrder(paidEvent("e4"))
    expect(r).toEqual({ settled: true, duplicate: false, status: "paid", isNewUser: false })
    expect(state.orderStatus).toBe("paid") // the paid transition still committed
  })
})
