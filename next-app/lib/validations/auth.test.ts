import { describe, it, expect } from "vitest"
import { registerSchema, loginSchema, passwordSchema } from "./auth"

describe("passwordSchema", () => {
  it("accepts a strong password", () => {
    expect(passwordSchema.safeParse("Abcd1234").success).toBe(true)
  })

  it("rejects too-short passwords", () => {
    const r = passwordSchema.safeParse("Ab1")
    expect(r.success).toBe(false)
  })

  it("requires an uppercase letter", () => {
    const r = passwordSchema.safeParse("abcd1234")
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toMatch(/uppercase/i)
  })

  it("requires a number", () => {
    const r = passwordSchema.safeParse("Abcdefgh")
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toMatch(/number/i)
  })
})

describe("registerSchema", () => {
  it("accepts a valid registration", () => {
    const r = registerSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "Abcd1234" })
    expect(r.success).toBe(true)
  })

  it("rejects an invalid email with the shared message", () => {
    const r = registerSchema.safeParse({ name: "Ada", email: "nope", password: "Abcd1234" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors.some((e) => /invalid email/i.test(e.message))).toBe(true)
  })

  it("rejects an empty name", () => {
    const r = registerSchema.safeParse({ name: "", email: "ada@example.com", password: "Abcd1234" })
    expect(r.success).toBe(false)
  })

  it("rejects a weak password (drift guard with server)", () => {
    const r = registerSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "weak" })
    expect(r.success).toBe(false)
  })
})

describe("loginSchema", () => {
  it("accepts a valid login", () => {
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "anything" }).success).toBe(true)
  })

  it("rejects an invalid email — this is the exact server re-validation loginAction now runs", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "x" })
    expect(r.success).toBe(false)
  })

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false)
  })
})
