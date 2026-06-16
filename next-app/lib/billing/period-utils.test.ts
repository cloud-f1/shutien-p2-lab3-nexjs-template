import { describe, expect, it } from "vitest"

import {
  ecpayNextChargeDate,
  ecpayPeriodEndDate,
  epochToDate,
  stripePeriodEndDate,
  stripePeriodEndEpoch,
} from "./period-utils"

describe("period-utils", () => {
  describe("stripePeriodEndEpoch", () => {
    it("reads the legacy top-level current_period_end", () => {
      expect(stripePeriodEndEpoch({ current_period_end: 1_700_000_000 })).toBe(1_700_000_000)
    })

    it("reads current_period_end from subscription items (Stripe v22+)", () => {
      const sub = {
        items: { data: [{ current_period_end: 1_711_111_111 }] },
      }
      expect(stripePeriodEndEpoch(sub)).toBe(1_711_111_111)
    })

    it("returns the MAX across multiple items (furthest renewal)", () => {
      const sub = {
        items: {
          data: [
            { current_period_end: 1_700_000_000 },
            { current_period_end: 1_722_222_222 },
            { current_period_end: 1_711_111_111 },
          ],
        },
      }
      expect(stripePeriodEndEpoch(sub)).toBe(1_722_222_222)
    })

    it("prefers a valid top-level field over items", () => {
      const sub = {
        current_period_end: 1_800_000_000,
        items: { data: [{ current_period_end: 1_700_000_000 }] },
      }
      expect(stripePeriodEndEpoch(sub)).toBe(1_800_000_000)
    })

    it("returns null for null/undefined/empty", () => {
      expect(stripePeriodEndEpoch(null)).toBeNull()
      expect(stripePeriodEndEpoch(undefined)).toBeNull()
      expect(stripePeriodEndEpoch({})).toBeNull()
      expect(stripePeriodEndEpoch({ items: { data: [] } })).toBeNull()
      expect(stripePeriodEndEpoch({ current_period_end: 0 })).toBeNull()
    })
  })

  describe("epochToDate", () => {
    it("converts unix seconds to a Date", () => {
      const d = epochToDate(1_700_000_000)
      expect(d).toBeInstanceOf(Date)
      expect(d!.getTime()).toBe(1_700_000_000 * 1000)
    })

    it("returns null for non-positive / non-finite", () => {
      expect(epochToDate(0)).toBeNull()
      expect(epochToDate(-1)).toBeNull()
      expect(epochToDate(null)).toBeNull()
      expect(epochToDate(undefined)).toBeNull()
      expect(epochToDate(NaN)).toBeNull()
    })
  })

  describe("stripePeriodEndDate", () => {
    it("returns a Date for a subscription with a period end", () => {
      const d = stripePeriodEndDate({ items: { data: [{ current_period_end: 1_700_000_000 }] } })
      expect(d!.getTime()).toBe(1_700_000_000 * 1000)
    })

    it("returns null when no period end is present", () => {
      expect(stripePeriodEndDate({})).toBeNull()
    })
  })

  describe("ecpayNextChargeDate", () => {
    const base = new Date("2026-01-15T00:00:00Z")

    it("advances one month for M", () => {
      const next = ecpayNextChargeDate(base, "M", 1)
      expect(next.getUTCMonth()).toBe(1) // February (0-indexed)
    })

    it("advances one year for Y", () => {
      const next = ecpayNextChargeDate(base, "Y", 1)
      expect(next.getUTCFullYear()).toBe(2027)
    })

    it("advances N days for D with frequency", () => {
      const next = ecpayNextChargeDate(base, "D", 7)
      expect(next.getUTCDate()).toBe(22)
    })

    it("defaults frequency to 1 when invalid", () => {
      const next = ecpayNextChargeDate(base, "M", 0)
      expect(next.getUTCMonth()).toBe(1)
    })
  })

  describe("ecpayPeriodEndDate", () => {
    it("uses an explicit current_period_end epoch when present", () => {
      const d = ecpayPeriodEndDate({ current_period_end: 1_700_000_000 })
      expect(d!.getTime()).toBe(1_700_000_000 * 1000)
    })

    it("derives next charge from last_period_at + period_type", () => {
      const d = ecpayPeriodEndDate({
        period_type: "M",
        last_period_at: "2026-03-01T00:00:00Z",
      })
      expect(d!.getUTCMonth()).toBe(3) // April
    })

    it("falls back to `from` + monthly when meta is bare", () => {
      const from = new Date("2026-06-01T00:00:00Z")
      const d = ecpayPeriodEndDate({}, from)
      expect(d!.getUTCMonth()).toBe(6) // July
    })

    it("tolerates null meta", () => {
      const from = new Date("2026-06-01T00:00:00Z")
      const d = ecpayPeriodEndDate(null, from)
      expect(d!.getUTCMonth()).toBe(6)
    })
  })
})
