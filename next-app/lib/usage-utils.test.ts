import { describe, expect, it } from "vitest"

import {
  aggregateUsage,
  assertWithinLimit,
  formatUsageDisplay,
  getPlanLimit,
  getUsagePeriod,
  type UsageEventLike,
} from "./usage-utils"

describe("aggregateUsage", () => {
  const events: UsageEventLike[] = [
    { metric: "api_request", delta: 1 },
    { metric: "api_request", delta: 3 },
    { metric: "tokens", delta: 100 },
    { metric: "api_request", delta: 2 },
  ]

  it("sums delta only for the matching metric (mixed metrics)", () => {
    expect(aggregateUsage(events, "api_request")).toBe(6)
    expect(aggregateUsage(events, "tokens")).toBe(100)
  })

  it("returns 0 for a metric with no events", () => {
    expect(aggregateUsage(events, "seats")).toBe(0)
  })

  it("returns 0 for the zero-event case", () => {
    expect(aggregateUsage([], "api_request")).toBe(0)
  })

  it("ignores non-finite deltas defensively", () => {
    const dirty: UsageEventLike[] = [
      { metric: "api_request", delta: 5 },
      { metric: "api_request", delta: Number.NaN },
      { metric: "api_request", delta: Infinity },
    ]
    expect(aggregateUsage(dirty, "api_request")).toBe(5)
  })
})

describe("getUsagePeriod", () => {
  it("returns the first instant of the current and next month (UTC)", () => {
    const now = new Date("2026-06-18T12:34:56.000Z")
    const { start, end } = getUsagePeriod(now)
    expect(start.toISOString()).toBe("2026-06-01T00:00:00.000Z")
    expect(end.toISOString()).toBe("2026-07-01T00:00:00.000Z")
  })

  it("rolls the end over the year boundary in December", () => {
    const now = new Date("2026-12-31T23:59:59.999Z")
    const { start, end } = getUsagePeriod(now)
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z")
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z")
  })

  it("is a half-open window: first-of-month is inside, end is exclusive", () => {
    const now = new Date("2026-06-15T00:00:00.000Z")
    const { start, end } = getUsagePeriod(now)
    // start is inclusive
    expect(new Date("2026-06-01T00:00:00.000Z").getTime()).toBe(start.getTime())
    // last instant of the month is < end
    expect(new Date("2026-06-30T23:59:59.999Z").getTime()).toBeLessThan(end.getTime())
    // end itself (first of next month) is NOT inside the window
    expect(new Date("2026-07-01T00:00:00.000Z").getTime()).toBe(end.getTime())
  })
})

describe("formatUsageDisplay", () => {
  it("renders unlimited when the limit is null", () => {
    const d = formatUsageDisplay(42, null)
    expect(d.label).toBe("42 / ∞")
    expect(d.hasLimit).toBe(false)
    expect(d.percent).toBe(0)
  })

  it("renders current / limit and the clamped fill percent", () => {
    const d = formatUsageDisplay(25, 100)
    expect(d.label).toBe("25 / 100")
    expect(d.hasLimit).toBe(true)
    expect(d.percent).toBe(25)
  })

  it("clamps the percent to 100 when over the limit", () => {
    const d = formatUsageDisplay(150, 100)
    expect(d.percent).toBe(100)
    expect(d.label).toBe("150 / 100")
  })

  it("treats a zero limit as fully consumed", () => {
    const d = formatUsageDisplay(0, 0)
    expect(d.hasLimit).toBe(true)
    expect(d.percent).toBe(100)
    expect(d.label).toBe("0 / 0")
  })

  it("renders zero usage cleanly", () => {
    const d = formatUsageDisplay(0, 100)
    expect(d.label).toBe("0 / 100")
    expect(d.percent).toBe(0)
  })

  it("treats a non-finite limit as unlimited", () => {
    const d = formatUsageDisplay(7, Number.POSITIVE_INFINITY)
    expect(d.label).toBe("7 / ∞")
    expect(d.hasLimit).toBe(false)
  })
})

describe("getPlanLimit", () => {
  // These assert against config/pricing.json (E308): free=1000, pro=50000,
  // scale=unlimited. Wired to the real config so a fork that edits the JSON sees
  // its caps flow through without touching code.
  it("reads a finite cap from the free tier", () => {
    expect(getPlanLimit("free", "api_request")).toBe(1000)
  })

  it("reads a finite cap from the pro tier", () => {
    expect(getPlanLimit("pro", "api_request")).toBe(50000)
  })

  it("returns null (unlimited) for a tier with no limits key (scale)", () => {
    expect(getPlanLimit("scale", "api_request")).toBeNull()
  })

  it("returns null (unlimited) for a metric absent from the limits map", () => {
    expect(getPlanLimit("free", "tokens")).toBeNull()
  })

  it("returns null (unlimited) for an unknown tier slug", () => {
    expect(getPlanLimit("enterprise", "api_request")).toBeNull()
  })

  it("accepts a PricingTier object directly", () => {
    const tier = {
      slug: "custom",
      limits: { api_request: 7 },
    } as unknown as Parameters<typeof getPlanLimit>[0]
    expect(getPlanLimit(tier, "api_request")).toBe(7)
  })

  it("treats a zero cap as a real (finite) limit, not unlimited", () => {
    const tier = { slug: "x", limits: { api_request: 0 } } as unknown as Parameters<
      typeof getPlanLimit
    >[0]
    expect(getPlanLimit(tier, "api_request")).toBe(0)
  })

  it("treats a negative cap as unlimited (defensive)", () => {
    const tier = { slug: "x", limits: { api_request: -5 } } as unknown as Parameters<
      typeof getPlanLimit
    >[0]
    expect(getPlanLimit(tier, "api_request")).toBeNull()
  })
})

describe("assertWithinLimit", () => {
  it("allows when projected usage stays at or under the cap", () => {
    const r = assertWithinLimit("free", "api_request", 998, 1)
    expect(r.allowed).toBe(true)
    expect(r.limit).toBe(1000)
    expect(r.projected).toBe(999)
    expect(r.reason).toBeNull()
  })

  it("allows when projected exactly equals the cap", () => {
    const r = assertWithinLimit("free", "api_request", 999, 1)
    expect(r.allowed).toBe(true)
    expect(r.projected).toBe(1000)
  })

  it("blocks when projected exceeds the cap, with a reason", () => {
    const r = assertWithinLimit("free", "api_request", 1000, 1)
    expect(r.allowed).toBe(false)
    expect(r.projected).toBe(1001)
    expect(r.reason).toContain("api_request")
    expect(r.reason).toContain("1000")
  })

  it("always allows an unlimited plan (null cap)", () => {
    const r = assertWithinLimit("scale", "api_request", 1_000_000, 5)
    expect(r.allowed).toBe(true)
    expect(r.limit).toBeNull()
    expect(r.projected).toBe(1_000_005)
    expect(r.reason).toBeNull()
  })

  it("defaults delta to 1", () => {
    const r = assertWithinLimit("free", "api_request", 1000)
    expect(r.allowed).toBe(false)
    expect(r.projected).toBe(1001)
  })

  it("clamps a non-finite current to 0 defensively", () => {
    const r = assertWithinLimit("free", "api_request", Number.NaN, 1)
    expect(r.projected).toBe(1)
    expect(r.allowed).toBe(true)
  })
})
