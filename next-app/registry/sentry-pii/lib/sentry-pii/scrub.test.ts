import { describe, expect, it } from "vitest"

import { createBeforeSend, maskPii, scrubEvent } from "./scrub"

describe("maskPii", () => {
  it("masks emails", () => {
    expect(maskPii("contact user@example.com now")).toBe("contact [REDACTED_EMAIL] now")
  })

  it("masks bearer tokens", () => {
    expect(maskPii("Authorization: Bearer abc123.def-456")).toBe(
      "Authorization: Bearer [REDACTED_TOKEN]",
    )
  })

  it("masks jwt-shaped strings", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGVzdHNpZw"
    expect(maskPii(`token=${jwt}`)).not.toContain(jwt)
  })

  it("masks secret key=value pairs", () => {
    expect(maskPii("api_key=sk_live_abcdef123")).toBe("api_key=[REDACTED_TOKEN]")
    expect(maskPii('password: "hunter2"')).toBe('password: "[REDACTED_TOKEN]"')
  })

  it("leaves ordinary text untouched", () => {
    expect(maskPii("nothing sensitive here")).toBe("nothing sensitive here")
  })

  it("applies opt-in idPatterns", () => {
    const idPatterns = [/\bID-\d{4,}\b/g]
    expect(maskPii("ticket ID-90210 escalated", { idPatterns })).toBe(
      "ticket [REDACTED_ID] escalated",
    )
  })

  it("supports a custom idMask", () => {
    const idPatterns = [/\bID-\d{4,}\b/g]
    expect(maskPii("ticket ID-90210", { idPatterns, idMask: "[X]" })).toBe("ticket [X]")
  })
})

describe("scrubEvent", () => {
  it("returns null for a nullish event", () => {
    expect(scrubEvent(null)).toBeNull()
    expect(scrubEvent(undefined)).toBeNull()
  })

  it("masks message and transaction", () => {
    const event = scrubEvent({
      message: "failed for user@example.com",
      transaction: "GET /api/user@example.com",
    })
    expect(event?.message).toBe("failed for [REDACTED_EMAIL]")
    expect(event?.transaction).toBe("GET /api/[REDACTED_EMAIL]")
  })

  it("drops user context entirely", () => {
    const event = scrubEvent({ user: { email: "user@example.com", id: "1" } })
    expect(event).not.toHaveProperty("user")
  })

  it("drops request body and cookies, strips authorization headers", () => {
    const event = scrubEvent({
      request: {
        data: { password: "hunter2" },
        cookies: "session=abc",
        headers: { Authorization: "Bearer secrettoken", "x-request-id": "req-1" },
        url: "https://example.com/u/user@example.com",
      },
    })
    expect(event?.request?.data).toBeUndefined()
    expect(event?.request?.cookies).toBeUndefined()
    expect(event?.request?.headers).not.toHaveProperty("Authorization")
    expect((event?.request?.headers as Record<string, unknown>)["x-request-id"]).toBe("req-1")
    expect(event?.request?.url).toBe("https://example.com/u/[REDACTED_EMAIL]")
  })

  it("masks exception values", () => {
    const event = scrubEvent({
      exception: { values: [{ value: "crash for user@example.com" }] },
    })
    expect(event?.exception?.values?.[0]?.value).toBe("crash for [REDACTED_EMAIL]")
  })

  it("is idempotent — scrubbing twice equals scrubbing once", () => {
    const once = scrubEvent({ message: "user@example.com Bearer abc123" })
    const twice = scrubEvent(structuredClone(once))
    expect(twice).toEqual(once)
  })
})

describe("createBeforeSend", () => {
  it("binds fixed options into a beforeSend-shaped function", () => {
    const beforeSend = createBeforeSend({ idPatterns: [/\bID-\d{4,}\b/g] })
    const event = beforeSend({ message: "case ID-1234 for user@example.com" })
    expect(event?.message).toBe("case [REDACTED_ID] for [REDACTED_EMAIL]")
  })
})
