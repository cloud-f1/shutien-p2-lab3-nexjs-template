/**
 * E327 — order access token (guest thank-you page) tests.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { orderAccessToken, verifyOrderAccessToken } from "./order-token"

const ORDER = "11111111-1111-1111-1111-111111111111"

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret"
})
afterEach(() => {
  delete process.env.AUTH_SECRET
})

describe("orderAccessToken", () => {
  it("is deterministic for the same (orderId, email)", () => {
    expect(orderAccessToken(ORDER, "a@b.com")).toBe(orderAccessToken(ORDER, "a@b.com"))
  })

  it("is case-insensitive on email", () => {
    expect(orderAccessToken(ORDER, "A@B.com")).toBe(orderAccessToken(ORDER, "a@b.com"))
  })

  it("differs for a different order id", () => {
    const other = "22222222-2222-2222-2222-222222222222"
    expect(orderAccessToken(ORDER, "a@b.com")).not.toBe(orderAccessToken(other, "a@b.com"))
  })

  it("differs for a different email", () => {
    expect(orderAccessToken(ORDER, "a@b.com")).not.toBe(orderAccessToken(ORDER, "c@d.com"))
  })
})

describe("verifyOrderAccessToken", () => {
  it("accepts the matching token", () => {
    const t = orderAccessToken(ORDER, "a@b.com")
    expect(verifyOrderAccessToken(ORDER, "a@b.com", t)).toBe(true)
  })

  it("rejects a wrong token", () => {
    expect(verifyOrderAccessToken(ORDER, "a@b.com", "deadbeef")).toBe(false)
  })

  it("rejects an empty token", () => {
    expect(verifyOrderAccessToken(ORDER, "a@b.com", "")).toBe(false)
  })

  it("rejects a token minted for a different email", () => {
    const t = orderAccessToken(ORDER, "attacker@evil.com")
    expect(verifyOrderAccessToken(ORDER, "a@b.com", t)).toBe(false)
  })
})
