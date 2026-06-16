import { describe, expect, it } from "vitest"

import {
  coercePlanUuid,
  isUuid,
  planRowFromPriceId,
  planRowFromTier,
  resolvePlanUuid,
  type PlanIdRow,
} from "./plan-resolver-utils"
import { PAID_TIERS, getTierBySlug } from "./pricing"

const UUID = "123e4567-e89b-42d3-a456-426614174000"

describe("plan-resolver-utils", () => {
  describe("isUuid", () => {
    it("accepts a canonical v4 UUID", () => {
      expect(isUuid(UUID)).toBe(true)
    })

    it("rejects a providerPriceId string", () => {
      expect(isUuid("price_pro_demo")).toBe(false)
      expect(isUuid("month:29:Pro")).toBe(false)
      expect(isUuid("")).toBe(false)
      expect(isUuid(null)).toBe(false)
      expect(isUuid(undefined)).toBe(false)
    })
  })

  describe("planRowFromTier", () => {
    it("maps a paid tier → plans insert row with cents amount", () => {
      const pro = getTierBySlug("pro")!
      const row = planRowFromTier(pro)
      expect(row.providerPriceId).toBe(pro.providerPriceId)
      expect(row.interval).toBe(pro.interval)
      expect(row.amount).toBe(pro.monthlyPrice * 100)
      expect(row.active).toBe(true)
    })

    it("throws for the free tier (no providerPriceId)", () => {
      const free = getTierBySlug("free")!
      expect(() => planRowFromTier(free)).toThrow(/not purchasable/)
    })
  })

  describe("planRowFromPriceId", () => {
    it("builds a row from a known config price id", () => {
      const pro = getTierBySlug("pro")!
      const row = planRowFromPriceId(pro.providerPriceId!)
      expect(row).not.toBeNull()
      expect(row!.amount).toBe(pro.monthlyPrice * 100)
    })

    it("returns null for an unknown price id", () => {
      expect(planRowFromPriceId("price_does_not_exist")).toBeNull()
    })

    it("covers every paid tier in config", () => {
      for (const tier of PAID_TIERS) {
        expect(planRowFromPriceId(tier.providerPriceId!)).not.toBeNull()
      }
    })
  })

  describe("resolvePlanUuid", () => {
    const rows: PlanIdRow[] = [
      { id: UUID, providerPriceId: "price_pro_demo" },
      { id: "223e4567-e89b-42d3-a456-426614174111", providerPriceId: "price_scale_demo" },
    ]

    it("resolves the UUID backing a providerPriceId", () => {
      expect(resolvePlanUuid(rows, "price_pro_demo")).toBe(UUID)
    })

    it("returns null when no row matches", () => {
      expect(resolvePlanUuid(rows, "price_unknown")).toBeNull()
    })
  })

  describe("coercePlanUuid", () => {
    const rows: PlanIdRow[] = [{ id: UUID, providerPriceId: "price_pro_demo" }]

    it("passes a real UUID straight through", () => {
      expect(coercePlanUuid(UUID, rows)).toBe(UUID)
    })

    it("coerces a legacy providerPriceId to the UUID via the rows", () => {
      expect(coercePlanUuid("price_pro_demo", rows)).toBe(UUID)
    })

    it("returns null for an unresolvable non-UUID value", () => {
      expect(coercePlanUuid("price_unknown", rows)).toBeNull()
      expect(coercePlanUuid(null, rows)).toBeNull()
      expect(coercePlanUuid(undefined, rows)).toBeNull()
    })
  })
})
