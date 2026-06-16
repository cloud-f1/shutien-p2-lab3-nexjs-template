/**
 * E292 — Customer Portal pure-helper unit tests.
 *
 * These are db-free: they pin the exact shape of the customer-id resolution and
 * the return_url the action passes to stripe.billingPortal.sessions.create.
 */

import { describe, expect, it } from "vitest"

import {
  PORTAL_NO_CUSTOMER_MESSAGE,
  PORTAL_UNSUPPORTED_MESSAGE,
  buildPortalReturnUrl,
  resolveStripeCustomerId,
} from "./portal-utils"

describe("resolveStripeCustomerId", () => {
  it("reads a bare customer id string (the webhook's normal shape)", () => {
    expect(resolveStripeCustomerId({ customer: "cus_123" })).toBe("cus_123")
  })

  it("reads a customer id from a { id } object (defensive)", () => {
    expect(resolveStripeCustomerId({ customer: { id: "cus_obj" } })).toBe("cus_obj")
  })

  it("returns null for null/undefined providerMeta", () => {
    expect(resolveStripeCustomerId(null)).toBeNull()
    expect(resolveStripeCustomerId(undefined)).toBeNull()
  })

  it("returns null when there is no customer key", () => {
    expect(resolveStripeCustomerId({ stripe_status: "active" })).toBeNull()
  })

  it("returns null for empty / whitespace customer ids", () => {
    expect(resolveStripeCustomerId({ customer: "" })).toBeNull()
    expect(resolveStripeCustomerId({ customer: "   " })).toBeNull()
    expect(resolveStripeCustomerId({ customer: { id: "" } })).toBeNull()
  })

  it("returns null when customer is a non-string, non-object value", () => {
    expect(resolveStripeCustomerId({ customer: 123 })).toBeNull()
  })
})

describe("buildPortalReturnUrl", () => {
  it("appends the billing surface path to the origin", () => {
    expect(buildPortalReturnUrl("https://app.example.com")).toBe(
      "https://app.example.com/dashboard/system",
    )
  })

  it("strips trailing slashes from the origin", () => {
    expect(buildPortalReturnUrl("https://app.example.com/")).toBe(
      "https://app.example.com/dashboard/system",
    )
    expect(buildPortalReturnUrl("http://localhost:3000///")).toBe(
      "http://localhost:3000/dashboard/system",
    )
  })

  it("falls back to a relative path when origin is empty/null", () => {
    expect(buildPortalReturnUrl("")).toBe("/dashboard/system")
    expect(buildPortalReturnUrl(null)).toBe("/dashboard/system")
    expect(buildPortalReturnUrl(undefined)).toBe("/dashboard/system")
  })
})

describe("portal messages", () => {
  it("exposes a clear unsupported-provider message", () => {
    expect(PORTAL_UNSUPPORTED_MESSAGE).toContain("不支援")
  })

  it("exposes a clear no-customer message", () => {
    expect(PORTAL_NO_CUSTOMER_MESSAGE).toContain("找不到")
  })
})
