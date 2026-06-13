import { describe, it, expect } from "vitest"
import { isAdmin, canEdit } from "./is-admin"

describe("isAdmin", () => {
  it("is true only for the admin role", () => {
    expect(isAdmin("admin")).toBe(true)
  })

  it("is false for the editor role", () => {
    expect(isAdmin("editor")).toBe(false)
  })

  it("is false for the viewer role", () => {
    expect(isAdmin("viewer")).toBe(false)
  })

  it("is false for undefined (no role on session)", () => {
    expect(isAdmin(undefined)).toBe(false)
  })

  it("is false for any unexpected string", () => {
    expect(isAdmin("superadmin")).toBe(false)
    expect(isAdmin("")).toBe(false)
  })
})

describe("canEdit", () => {
  it("is true for admin", () => {
    expect(canEdit("admin")).toBe(true)
  })

  it("is true for editor", () => {
    expect(canEdit("editor")).toBe(true)
  })

  it("is false for viewer (read-only)", () => {
    expect(canEdit("viewer")).toBe(false)
  })

  it("is false for undefined", () => {
    expect(canEdit(undefined)).toBe(false)
  })

  it("is false for any unexpected string", () => {
    expect(canEdit("superadmin")).toBe(false)
    expect(canEdit("")).toBe(false)
  })
})
