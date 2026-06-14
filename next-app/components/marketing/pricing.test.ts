import { describe, it, expect } from "vitest"
import { DEFAULT_PRICING_TIERS } from "./pricing"

describe("DEFAULT_PRICING_TIERS", () => {
  it("exports an array with three tiers", () => {
    expect(Array.isArray(DEFAULT_PRICING_TIERS)).toBe(true)
    expect(DEFAULT_PRICING_TIERS).toHaveLength(3)
  })

  it("each tier has the required shape fields", () => {
    for (const tier of DEFAULT_PRICING_TIERS) {
      expect(typeof tier.planId).toBe("string")
      expect(tier.planId.length).toBeGreaterThan(0)
      expect(typeof tier.name).toBe("string")
      expect(typeof tier.description).toBe("string")
      expect(typeof tier.monthlyPrice).toBe("number")
      expect(tier.monthlyPrice).toBeGreaterThanOrEqual(0)
      expect(["month", "year", "week", "day"]).toContain(tier.interval)
      expect(Array.isArray(tier.features)).toBe(true)
      expect(tier.features.length).toBeGreaterThan(0)
      expect(typeof tier.ctaLabel).toBe("string")
      expect(typeof tier.ctaHref).toBe("string")
    }
  })

  it("free tier has zero price", () => {
    const free = DEFAULT_PRICING_TIERS.find((t) => t.planId === "free")
    expect(free).toBeDefined()
    expect(free!.monthlyPrice).toBe(0)
  })

  it("pro tier is highlighted", () => {
    const pro = DEFAULT_PRICING_TIERS.find((t) => t.planId === "pro")
    expect(pro).toBeDefined()
    expect(pro!.highlighted).toBe(true)
  })

  it("all CTA hrefs start with /register", () => {
    for (const tier of DEFAULT_PRICING_TIERS) {
      expect(tier.ctaHref).toMatch(/^\/register/)
    }
  })

  it("enterprise tier has more features than free tier", () => {
    const free = DEFAULT_PRICING_TIERS.find((t) => t.planId === "free")
    const enterprise = DEFAULT_PRICING_TIERS.find((t) => t.planId === "enterprise")
    expect(enterprise!.features.length).toBeGreaterThan(free!.features.length)
  })

  it("plan IDs are unique", () => {
    const ids = DEFAULT_PRICING_TIERS.map((t) => t.planId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
