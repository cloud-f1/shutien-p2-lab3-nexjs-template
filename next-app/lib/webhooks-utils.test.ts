import { describe, expect, it } from "vitest"

import {
  backoffMs,
  generateWebhookSecret,
  parseSignatureHeader,
  signWebhook,
  verifyWebhook,
} from "./webhooks-utils"

describe("webhooks-utils", () => {
  it("generates a whsec_-prefixed secret", () => {
    const s = generateWebhookSecret()
    expect(s.startsWith("whsec_")).toBe(true)
    expect(s.length).toBeGreaterThan(20)
    expect(generateWebhookSecret()).not.toBe(s) // random each time
  })

  it("signs and verifies a payload roundtrip", () => {
    const secret = generateWebhookSecret()
    const payload = JSON.stringify({ event: "ping", data: { ok: true } })
    const header = signWebhook(payload, secret, 1_700_000_000)
    expect(header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/)
    expect(verifyWebhook(payload, secret, header)).toBe(true)
  })

  it("rejects a tampered body, wrong secret, or malformed header", () => {
    const secret = generateWebhookSecret()
    const payload = "{}"
    const header = signWebhook(payload, secret, 1_700_000_000)
    expect(verifyWebhook('{"x":1}', secret, header)).toBe(false)
    expect(verifyWebhook(payload, generateWebhookSecret(), header)).toBe(false)
    expect(verifyWebhook(payload, secret, "garbage")).toBe(false)
    expect(verifyWebhook(payload, secret, null)).toBe(false)
  })

  it("enforces the replay tolerance window when now is provided", () => {
    const secret = generateWebhookSecret()
    const payload = "{}"
    const t = 1_700_000_000
    const header = signWebhook(payload, secret, t)
    // within tolerance
    expect(verifyWebhook(payload, secret, header, { toleranceSeconds: 300, now: t + 100 })).toBe(true)
    // outside tolerance → rejected even with a valid signature
    expect(verifyWebhook(payload, secret, header, { toleranceSeconds: 300, now: t + 600 })).toBe(false)
  })

  it("parses a signature header into parts", () => {
    expect(parseSignatureHeader("t=123,v1=abc")).toEqual({ t: 123, v1: "abc" })
    expect(parseSignatureHeader("v1=abc")).toBeNull()
    expect(parseSignatureHeader("t=notanumber,v1=abc")).toBeNull()
    expect(parseSignatureHeader(null)).toBeNull()
  })

  it("backs off quadratically and caps", () => {
    expect(backoffMs(1)).toBe(1000)
    expect(backoffMs(2)).toBe(4000)
    expect(backoffMs(3)).toBe(9000)
    expect(backoffMs(100)).toBe(60_000) // capped
  })
})
