/**
 * E334 — recordSalesPageEvent() best-effort contract. The funnel write must
 * NEVER throw into the collect route / page (a telemetry failure is invisible).
 * The DB is mocked (node env, no Postgres); aggregation math is unit-tested
 * separately in funnel-utils.test.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
  shouldThrow: false,
}))

vi.mock("@/lib/db", () => ({
  db: {
    insert() {
      return {
        values: async (v: Record<string, unknown>) => {
          if (state.shouldThrow) throw new Error("db down")
          state.inserted.push(v)
          return undefined
        },
      }
    },
  },
}))

vi.mock("@/lib/schema", () => ({
  salesPageEventsTable: { __t: "sales_page_events" },
  ordersTable: { __t: "orders" },
  salesPagesTable: { __t: "sales_pages" },
}))

import { recordSalesPageEvent } from "./funnel"

afterEach(() => {
  state.inserted = []
  state.shouldThrow = false
  vi.clearAllMocks()
})

describe("recordSalesPageEvent", () => {
  it("normalises UTM and inserts a row", async () => {
    await recordSalesPageEvent({
      slug: "launch",
      event: "cta_click",
      sessionHash: "hash1",
      utm: { source: "  IG ", medium: "", campaign: "summer" },
    })
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted[0]).toMatchObject({
      slug: "launch",
      event: "cta_click",
      sessionHash: "hash1",
      utmSource: "IG",
      utmMedium: null,
      utmCampaign: "summer",
    })
  })

  it("swallows a DB failure — telemetry never throws", async () => {
    state.shouldThrow = true
    await expect(
      recordSalesPageEvent({ slug: "x", event: "page_view", sessionHash: "h" }),
    ).resolves.toBeUndefined()
  })
})
