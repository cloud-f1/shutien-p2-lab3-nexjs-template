import { describe, it, expect } from "vitest"
import { isAdmin } from "./is-admin"

describe("isAdmin", () => {
  it("is true only for the admin role", () => {
    expect(isAdmin("admin")).toBe(true)
  })

  it("is false for the user role", () => {
    expect(isAdmin("user")).toBe(false)
  })

  it("is false for undefined (no role on session)", () => {
    expect(isAdmin(undefined)).toBe(false)
  })

  it("is false for any unexpected string", () => {
    expect(isAdmin("superadmin")).toBe(false)
    expect(isAdmin("")).toBe(false)
  })
})
