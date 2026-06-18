import { describe, expect, it } from "vitest"

import { assertCanWriteItems, assertItemOwner, validateItemTitle } from "./items-utils"

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

describe("assertItemOwner", () => {
  it("returns null when actor owns the item", () => {
    expect(assertItemOwner("user-1", "user-1")).toBeNull()
  })

  it("returns an edit error when actor does not own the item", () => {
    const err = assertItemOwner("user-1", "user-2", "edit")
    expect(err).toMatch(/編輯/)
  })

  it("returns a delete error when actor does not own the item", () => {
    const err = assertItemOwner("user-1", "user-2", "delete")
    expect(err).toMatch(/刪除/)
  })

  it("defaults to the edit error message", () => {
    const err = assertItemOwner("a", "b")
    expect(err).toMatch(/編輯/)
  })
})

describe("assertCanWriteItems", () => {
  it("allows admin", () => {
    expect(assertCanWriteItems("admin")).toBeNull()
  })

  it("allows editor", () => {
    expect(assertCanWriteItems("editor")).toBeNull()
  })

  it("denies viewer", () => {
    expect(assertCanWriteItems("viewer")).toMatch(/編輯者|管理員/)
  })

  it("denies undefined role", () => {
    expect(assertCanWriteItems(undefined)).toMatch(/編輯者|管理員/)
  })

  it("denies unknown roles", () => {
    expect(assertCanWriteItems("superadmin")).toMatch(/編輯者|管理員/)
  })
})
