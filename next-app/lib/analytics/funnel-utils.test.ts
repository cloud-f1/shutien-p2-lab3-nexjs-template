import { describe, expect, it } from "vitest"

import {
  aggregateChannelRows,
  aggregateFunnelRows,
  channelKey,
  channelLabel,
  computeStats,
  DIRECT_CHANNEL_LABEL,
  isEmptyUtm,
  normalizeUtm,
  rate,
  type ChannelEventCountRow,
  type ChannelPaidCountRow,
  type EventCountRow,
  type PaidCountRow,
} from "./funnel-utils"

describe("normalizeUtm", () => {
  it("accepts both short and utm_-prefixed keys, trims, and nulls empties", () => {
    expect(normalizeUtm({ utm_source: "  Google ", medium: "cpc", utm_campaign: "" })).toEqual({
      source: "Google",
      medium: "cpc",
      campaign: null,
    })
  })

  it("null / undefined / whitespace / non-string all normalise to null", () => {
    expect(normalizeUtm(null)).toEqual({ source: null, medium: null, campaign: null })
    expect(normalizeUtm({ source: "   ", medium: 42 as unknown as string })).toEqual({
      source: null,
      medium: null,
      campaign: null,
    })
  })

  it("caps each field at 200 chars", () => {
    const long = "a".repeat(500)
    expect(normalizeUtm({ source: long }).source).toHaveLength(200)
  })
})

describe("channel helpers", () => {
  it("isEmptyUtm detects fully untagged traffic", () => {
    expect(isEmptyUtm(normalizeUtm(null))).toBe(true)
    expect(isEmptyUtm(normalizeUtm({ source: "x" }))).toBe(false)
  })

  it("channelKey is stable and distinguishes channels", () => {
    const a = normalizeUtm({ source: "ig", medium: "social" })
    const b = normalizeUtm({ source: "ig", medium: "social" })
    const c = normalizeUtm({ source: "ig", medium: "email" })
    expect(channelKey(a)).toBe(channelKey(b))
    expect(channelKey(a)).not.toBe(channelKey(c))
  })

  it("channelLabel falls back to the direct label when untagged", () => {
    expect(channelLabel(normalizeUtm(null))).toBe(DIRECT_CHANNEL_LABEL)
    expect(channelLabel(normalizeUtm({ source: "fb", medium: "cpc", campaign: "launch" }))).toBe(
      "fb / cpc / launch",
    )
  })
})

describe("rate / computeStats", () => {
  it("rate guards against zero denominator and clamps to [0,1]", () => {
    expect(rate(3, 0)).toBe(0)
    expect(rate(5, 10)).toBe(0.5)
    expect(rate(10, 5)).toBe(1)
    expect(rate(-1, 5)).toBe(0)
  })

  it("computeStats derives all four funnel rates", () => {
    const s = computeStats({ views: 100, ctaClicks: 40, checkoutStarted: 10, paid: 3 })
    expect(s.ctaRate).toBeCloseTo(0.4)
    expect(s.checkoutRate).toBeCloseTo(0.25)
    expect(s.paymentRate).toBeCloseTo(0.3)
    expect(s.overallRate).toBeCloseTo(0.03)
  })
})

describe("aggregateFunnelRows", () => {
  const eventRows: EventCountRow[] = [
    { slug: "launch", event: "page_view", count: 200 },
    { slug: "launch", event: "cta_click", count: 50 },
    { slug: "launch", event: "checkout_started", count: 20 },
    { slug: "quiet", event: "page_view", count: 10 },
  ]
  const paidRows: PaidCountRow[] = [
    { slug: "launch", count: 8 },
    // 'revenue-only' has paid orders but events were pruned — must still surface.
    { slug: "revenue-only", count: 2 },
  ]

  it("folds events + paid into one row per slug with rates", () => {
    const rows = aggregateFunnelRows(eventRows, paidRows)
    const launch = rows.find((r) => r.slug === "launch")!
    expect(launch).toMatchObject({ views: 200, ctaClicks: 50, checkoutStarted: 20, paid: 8 })
    expect(launch.overallRate).toBeCloseTo(0.04)
  })

  it("surfaces paid-only slugs even with zero events", () => {
    const rows = aggregateFunnelRows(eventRows, paidRows)
    const revenueOnly = rows.find((r) => r.slug === "revenue-only")!
    expect(revenueOnly).toMatchObject({ views: 0, paid: 2 })
    expect(revenueOnly.overallRate).toBe(0)
  })

  it("sorts by views desc (busiest page first)", () => {
    const rows = aggregateFunnelRows(eventRows, paidRows)
    expect(rows[0].slug).toBe("launch")
  })
})

describe("aggregateChannelRows", () => {
  const ig = normalizeUtm({ source: "ig", medium: "social" })
  const direct = normalizeUtm(null)
  const eventRows: ChannelEventCountRow[] = [
    { slug: "launch", event: "page_view", count: 120, utm: ig },
    { slug: "launch", event: "cta_click", count: 30, utm: ig },
    { slug: "launch", event: "page_view", count: 80, utm: direct },
    { slug: "other", event: "page_view", count: 999, utm: ig },
  ]
  const paidRows: ChannelPaidCountRow[] = [{ slug: "launch", count: 5, utm: ig }]

  it("buckets by channel for the given slug only and attaches paid", () => {
    const channels = aggregateChannelRows("launch", eventRows, paidRows)
    expect(channels).toHaveLength(2)
    const igRow = channels.find((c) => c.label === "ig / social")!
    expect(igRow).toMatchObject({ views: 120, ctaClicks: 30, paid: 5 })
    // Rows for slug 'other' must be ignored.
    expect(channels.some((c) => c.views === 999)).toBe(false)
  })

  it("labels the untagged bucket as direct", () => {
    const channels = aggregateChannelRows("launch", eventRows, paidRows)
    expect(channels.some((c) => c.label === DIRECT_CHANNEL_LABEL)).toBe(true)
  })
})
