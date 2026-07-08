import { describe, expect, it } from "vitest"

import {
  assertCurrentPasswordValid,
  assertHasPassword,
  assertPasswordChanged,
} from "./user-utils"

describe("assertHasPassword", () => {
  it("returns null when a password hash is present", () => {
    expect(assertHasPassword("$2b$10$somehash")).toBeNull()
  })

  it("returns an error for null (OAuth account)", () => {
    expect(assertHasPassword(null)).toMatch(/OAuth/)
  })

  it("returns an error for undefined (OAuth account)", () => {
    expect(assertHasPassword(undefined)).toMatch(/OAuth/)
  })

  it("returns an error for an empty string (missing hash)", () => {
    expect(assertHasPassword("")).toMatch(/OAuth/)
  })
})

describe("assertCurrentPasswordValid", () => {
  it("returns null when the current password is valid", () => {
    expect(assertCurrentPasswordValid(true)).toBeNull()
  })

  it("returns an error when the current password is wrong", () => {
    const err = assertCurrentPasswordValid(false)
    expect(err).toMatch(/目前密碼/)
  })
})

describe("assertPasswordChanged", () => {
  it("returns null when new password differs from current", () => {
    expect(assertPasswordChanged("OldPass1!", "NewPass2@")).toBeNull()
  })

  it("returns an error when new password is identical to current", () => {
    const err = assertPasswordChanged("SamePass1!", "SamePass1!")
    expect(err).toMatch(/相同/)
  })
})
