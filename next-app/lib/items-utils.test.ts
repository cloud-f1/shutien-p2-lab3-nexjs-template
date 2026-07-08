import { describe, expect, it } from "vitest"

import { validateItemTitle } from "./items-utils"

describe("validateItemTitle", () => {
  it("accepts a valid title and trims whitespace", () => {
    const result = validateItemTitle("  Hello  ")
    expect(result).toEqual({ title: "Hello" })
  })

  it("rejects an empty string", () => {
    const result = validateItemTitle("")
    expect(result).toEqual({ error: "請輸入標題" })
  })

  it("rejects a whitespace-only string", () => {
    const result = validateItemTitle("   ")
    expect(result).toEqual({ error: "請輸入標題" })
  })

  it("rejects null / undefined / non-string values", () => {
    expect(validateItemTitle(null)).toEqual({ error: "請輸入標題" })
    expect(validateItemTitle(undefined)).toEqual({ error: "請輸入標題" })
    expect(validateItemTitle(42)).toEqual({ error: "請輸入標題" })
  })

  it("rejects a title over 255 characters", () => {
    const result = validateItemTitle("a".repeat(256))
    expect(result).toEqual({ error: "標題過長（最多 255 個字元）。" })
  })

  it("accepts exactly 255 characters", () => {
    const result = validateItemTitle("a".repeat(255))
    expect(result).toEqual({ title: "a".repeat(255) })
  })
})
