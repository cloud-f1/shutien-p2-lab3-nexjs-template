import { describe, it, expect } from "vitest"

import { PRICING_TIERS, PAID_TIERS, getTierBySlug, getTierByPriceId } from "./pricing"

// Pricing is loaded from config/pricing.json (E274) — these guard the contract.
describe("pricing config", () => {
  it("loads tiers from config/pricing.json", () => {
    expect(Array.isArray(PRICING_TIERS)).toBe(true)
    expect(PRICING_TIERS.length).toBeGreaterThanOrEqual(2)
  })

  it("each tier has the required shape", () => {
    for (const t of PRICING_TIERS) {
      expect(typeof t.slug).toBe("string")
      expect(t.slug.length).toBeGreaterThan(0)
      expect(typeof t.name).toBe("string")
      expect(typeof t.description).toBe("string")
      expect(typeof t.monthlyPrice).toBe("number")
      expect(t.monthlyPrice).toBeGreaterThanOrEqual(0)
      expect(["month", "year", "week", "day"]).toContain(t.interval)
      expect(Array.isArray(t.features)).toBe(true)
      expect(t.features.length).toBeGreaterThan(0)
      expect(typeof t.ctaLabel).toBe("string")
    }
  })

  it("free tier has zero price and no providerPriceId", () => {
    const free = getTierBySlug("free")
    expect(free).toBeDefined()
    expect(free!.monthlyPrice).toBe(0)
    expect(free!.providerPriceId).toBeNull()
  })

  it("paid tiers all carry a providerPriceId", () => {
    expect(PAID_TIERS.length).toBeGreaterThan(0)
    for (const t of PAID_TIERS) expect(typeof t.providerPriceId).toBe("string")
  })

  it("getTierByPriceId resolves a paid tier by its price id", () => {
    const t = PAID_TIERS[0]
    expect(getTierByPriceId(t.providerPriceId!)?.slug).toBe(t.slug)
    expect(getTierByPriceId("does-not-exist")).toBeUndefined()
  })

  it("slugs are unique", () => {
    const slugs = PRICING_TIERS.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
