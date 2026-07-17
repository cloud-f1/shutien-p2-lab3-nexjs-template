import { beforeEach, describe, expect, it } from "vitest"

import { dayScopedSessionHash, utcDayStamp } from "./session-hash"

beforeEach(() => {
  process.env.AUTH_SECRET = "test-funnel-secret"
})

const parts = { ip: "203.0.113.5", userAgent: "Mozilla/5.0" }

describe("dayScopedSessionHash", () => {
  it("is deterministic for the same client within the same day", () => {
    const day = "2026-07-13"
    expect(dayScopedSessionHash({ ...parts, day })).toBe(dayScopedSessionHash({ ...parts, day }))
  })

  it("rotates across calendar days (day-scoped, not cross-day trackable)", () => {
    const a = dayScopedSessionHash({ ...parts, day: "2026-07-13" })
    const b = dayScopedSessionHash({ ...parts, day: "2026-07-14" })
    expect(a).not.toBe(b)
  })

  it("differs by client fingerprint", () => {
    const day = "2026-07-13"
    const a = dayScopedSessionHash({ ip: "203.0.113.5", userAgent: "A", day })
    const b = dayScopedSessionHash({ ip: "203.0.113.6", userAgent: "A", day })
    expect(a).not.toBe(b)
  })

  it("stores NO raw PII — the digest contains neither the IP nor the UA", () => {
    const hash = dayScopedSessionHash({ ...parts, day: "2026-07-13" })
    expect(hash).not.toContain("203.0.113.5")
    expect(hash).not.toContain("Mozilla")
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it("handles missing ip / user-agent without throwing", () => {
    expect(dayScopedSessionHash({ ip: null, userAgent: null, day: "2026-07-13" })).toMatch(
      /^[0-9a-f]{32}$/,
    )
  })

  it("utcDayStamp yields a YYYY-MM-DD string", () => {
    expect(utcDayStamp(new Date("2026-07-13T23:59:00Z"))).toBe("2026-07-13")
  })
})
