/**
 * E327 — one-time checkout payload (Zod) contract tests.
 */
import { describe, expect, it } from "vitest"
import { oneTimeCheckoutSchema } from "./checkout-schema"

describe("oneTimeCheckoutSchema", () => {
  it("accepts a minimal valid guest payload", () => {
    const r = oneTimeCheckoutSchema.safeParse({
      productSlug: "nextjs-course",
      email: "buyer@example.com",
    })
    expect(r.success).toBe(true)
  })

  it("accepts name + gateway override", () => {
    const r = oneTimeCheckoutSchema.safeParse({
      productSlug: "nextjs-course",
      email: "buyer@example.com",
      name: "王小明",
      gateway: "ecpay",
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.gateway).toBe("ecpay")
  })

  it("rejects a missing product slug", () => {
    const r = oneTimeCheckoutSchema.safeParse({ email: "buyer@example.com" })
    expect(r.success).toBe(false)
  })

  it("rejects an empty product slug", () => {
    const r = oneTimeCheckoutSchema.safeParse({ productSlug: "  ", email: "a@b.com" })
    expect(r.success).toBe(false)
  })

  it("rejects an invalid email", () => {
    const r = oneTimeCheckoutSchema.safeParse({
      productSlug: "nextjs-course",
      email: "not-an-email",
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/電子郵件/)
  })

  it("rejects an unsupported gateway (e.g. newebpay) at the payload boundary", () => {
    const r = oneTimeCheckoutSchema.safeParse({
      productSlug: "nextjs-course",
      email: "buyer@example.com",
      gateway: "newebpay",
    })
    expect(r.success).toBe(false)
  })

  it("trims and lower-cases nothing unexpected — email is trimmed", () => {
    const r = oneTimeCheckoutSchema.safeParse({
      productSlug: "nextjs-course",
      email: "  buyer@example.com  ",
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe("buyer@example.com")
  })
})
