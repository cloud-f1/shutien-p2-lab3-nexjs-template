/**
 * E330 — dispatchSystemEvent() tests. Verifies the CRM-egress fan-out over
 * system-scoped endpoints reuses deliverToEndpoint (HMAC-signed POST) and:
 *   • only hits endpoints subscribed to the event (or "*");
 *   • signs each body with the endpoint's own secret;
 *   • is best-effort — a DB lookup failure returns 0, never throws.
 *
 * @/lib/db is mocked (no Postgres); global.fetch is mocked (no network).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  endpoints: [] as { id: string; url: string; secret: string; events: string[] }[],
  selectThrows: false,
  deliveries: [] as { webhookId: string; status: string }[],
}))

vi.mock("@/lib/db", () => {
  const db = {
    select() {
      return {
        from: () => ({
          where: async () => {
            if (state.selectThrows) throw new Error("db down")
            return state.endpoints
          },
        }),
      }
    },
    insert() {
      return {
        values: async (v: { webhookId: string; status: string }) => {
          state.deliveries.push({ webhookId: v.webhookId, status: v.status })
        },
      }
    },
  }
  return { db }
})

vi.mock("@/lib/schema", () => ({
  webhooksTable: { __t: "webhooks", scope: "scope", active: "active" },
  webhookDeliveriesTable: { __t: "webhook_deliveries" },
}))
vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ __eq: a }),
  and: (...a: unknown[]) => ({ __and: a }),
  desc: (...a: unknown[]) => ({ __desc: a }),
}))

import { dispatchSystemEvent } from "./webhooks"

const fetchMock = vi.fn()

beforeEach(() => {
  state.endpoints = []
  state.selectThrows = false
  state.deliveries = []
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200 })
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("dispatchSystemEvent (E330)", () => {
  it("delivers only to endpoints subscribed to the event (or *)", async () => {
    state.endpoints = [
      { id: "w1", url: "https://a.example/hook", secret: "s1", events: ["order.completed"] },
      { id: "w2", url: "https://b.example/hook", secret: "s2", events: ["*"] },
      { id: "w3", url: "https://c.example/hook", secret: "s3", events: ["user.created"] },
    ]
    const n = await dispatchSystemEvent("order.completed", { orderId: "o1" })
    expect(n).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const urls = fetchMock.mock.calls.map((c) => c[0])
    expect(urls).toContain("https://a.example/hook")
    expect(urls).toContain("https://b.example/hook")
    expect(urls).not.toContain("https://c.example/hook")
  })

  it("signs each POST with a t=…,v1=… HMAC header and records a delivery", async () => {
    state.endpoints = [
      { id: "w1", url: "https://a.example/hook", secret: "s1", events: ["order.completed"] },
    ]
    await dispatchSystemEvent("order.completed", { orderId: "o1" })

    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string>; body: string }
    expect(init.headers["x-webhook-event"]).toBe("order.completed")
    expect(init.headers["x-webhook-signature"]).toMatch(/^t=\d+,v1=[0-9a-f]+$/)
    expect(JSON.parse(init.body)).toMatchObject({ event: "order.completed", data: { orderId: "o1" } })
    expect(state.deliveries).toEqual([{ webhookId: "w1", status: "success" }])
  })

  it("returns 0 and never throws when the endpoint lookup fails", async () => {
    state.selectThrows = true
    await expect(dispatchSystemEvent("order.completed", { orderId: "o1" })).resolves.toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 0 when no system endpoints are subscribed", async () => {
    state.endpoints = [
      { id: "w3", url: "https://c.example/hook", secret: "s3", events: ["user.created"] },
    ]
    const n = await dispatchSystemEvent("order.completed", { orderId: "o1" })
    expect(n).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
