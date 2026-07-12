import { describe, expect, it } from "vitest"

import { getRemainingTime, padSegment } from "@/lib/sales/countdown"

describe("getRemainingTime", () => {
  it("computes days/hours/minutes/seconds remaining until a future deadline", () => {
    const now = new Date("2026-07-12T00:00:00.000Z")
    const deadline = new Date("2026-07-15T02:03:04.000Z") // +3d 2h 3m 4s
    const result = getRemainingTime(deadline, now)

    expect(result).toEqual({
      days: 3,
      hours: 2,
      minutes: 3,
      seconds: 4,
      expired: false,
    })
  })

  it("marks the countdown expired once now passes the deadline", () => {
    const now = new Date("2026-07-16T00:00:00.000Z")
    const deadline = new Date("2026-07-15T00:00:00.000Z")
    const result = getRemainingTime(deadline, now)

    expect(result.expired).toBe(true)
    expect(result).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true })
  })

  it("treats the exact deadline instant as expired (no negative/zero-flash edge case)", () => {
    const now = new Date("2026-07-15T00:00:00.000Z")
    const deadline = new Date("2026-07-15T00:00:00.000Z")
    expect(getRemainingTime(deadline, now).expired).toBe(true)
  })

  it("never reappears/resets after expiry even if re-evaluated later", () => {
    const deadline = new Date("2026-07-15T00:00:00.000Z")
    const first = getRemainingTime(deadline, new Date("2026-07-16T00:00:00.000Z"))
    const later = getRemainingTime(deadline, new Date("2026-08-01T00:00:00.000Z"))
    expect(first.expired).toBe(true)
    expect(later.expired).toBe(true)
  })

  it("accepts a string deadline and string now", () => {
    const result = getRemainingTime("2026-07-15T00:00:10.000Z", "2026-07-15T00:00:00.000Z")
    expect(result).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 10, expired: false })
  })

  it("treats an invalid deadline as expired rather than throwing", () => {
    expect(getRemainingTime("not-a-date").expired).toBe(true)
  })
})

describe("padSegment", () => {
  it("zero-pads single digits", () => {
    expect(padSegment(3)).toBe("03")
  })

  it("leaves double digits untouched", () => {
    expect(padSegment(42)).toBe("42")
  })

  it("clamps negative values to 0", () => {
    expect(padSegment(-5)).toBe("00")
  })
})
