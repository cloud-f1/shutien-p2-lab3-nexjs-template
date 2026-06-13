import { describe, it, expect } from "vitest"
import { updateProfileSchema, changePasswordSchema } from "./user"

describe("updateProfileSchema", () => {
  it("accepts a name with an empty image", () => {
    expect(updateProfileSchema.safeParse({ name: "Ada", image: "" }).success).toBe(true)
  })

  it("accepts a name with a valid image URL", () => {
    expect(updateProfileSchema.safeParse({ name: "Ada", image: "https://x.com/a.png" }).success).toBe(true)
  })

  it("rejects an empty name", () => {
    expect(updateProfileSchema.safeParse({ name: "", image: "" }).success).toBe(false)
  })

  it("rejects a name over 100 chars", () => {
    expect(updateProfileSchema.safeParse({ name: "a".repeat(101), image: "" }).success).toBe(false)
  })

  it("rejects a non-URL image", () => {
    expect(updateProfileSchema.safeParse({ name: "Ada", image: "not-a-url" }).success).toBe(false)
  })

  it("rejects a non-https (http) image URL", () => {
    const r = updateProfileSchema.safeParse({ name: "Ada", image: "http://x.com/a.png" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toMatch(/https/)
  })
})

describe("changePasswordSchema", () => {
  const base = { currentPassword: "old", newPassword: "Abcd1234", confirmPassword: "Abcd1234" }

  it("accepts a matching, strong new password", () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true)
  })

  it("rejects when confirmation does not match", () => {
    const r = changePasswordSchema.safeParse({ ...base, confirmPassword: "Different1" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.errors[0].message).toMatch(/密碼不一致/)
      expect(r.error.errors[0].path).toContain("confirmPassword")
    }
  })

  it("rejects a weak new password (reuses passwordSchema)", () => {
    const r = changePasswordSchema.safeParse({ ...base, newPassword: "weak", confirmPassword: "weak" })
    expect(r.success).toBe(false)
  })

  it("rejects an empty current password", () => {
    expect(changePasswordSchema.safeParse({ ...base, currentPassword: "" }).success).toBe(false)
  })
})
