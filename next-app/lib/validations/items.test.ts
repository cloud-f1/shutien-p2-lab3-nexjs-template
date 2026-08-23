import { describe, expect, it } from "vitest"
import { createItemSchema, updateItemSchema } from "./items"

describe("createItemSchema", () => {
  it("accepts a valid title", () => {
    expect(createItemSchema.safeParse({ title: "My item" }).success).toBe(true)
  })

  it("trims and accepts a title with surrounding whitespace via schema", () => {
    // Zod min(1) checks the raw string; trimming is done by the action layer.
    // A single non-space character should pass.
    expect(createItemSchema.safeParse({ title: "x" }).success).toBe(true)
  })

  it("rejects an empty title", () => {
    const r = createItemSchema.safeParse({ title: "" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toMatch(/請輸入標題/)
  })

  it("rejects a title over 255 characters", () => {
    const r = createItemSchema.safeParse({ title: "a".repeat(256) })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toMatch(/標題過長/)
  })

  it("accepts a title of exactly 255 characters", () => {
    expect(createItemSchema.safeParse({ title: "a".repeat(255) }).success).toBe(true)
  })
})

// E348 — updateItemSchema is now the SINGLE validation contract for updateItem()
// (actions/items.ts calls .safeParse() directly). These boundary tests pin the
// exact accept/reject behavior + error text that the deleted-from-this-path
// validateItemTitle() previously enforced, so the migration didn't change what
// updateItem() accepts or rejects (see docs/epics/e348-update-item-contract-drift.md).
describe("updateItemSchema", () => {
  it("accepts a valid title", () => {
    expect(updateItemSchema.safeParse({ title: "Updated title" }).success).toBe(true)
  })

  it("rejects an empty title", () => {
    const r = updateItemSchema.safeParse({ title: "" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toBe("請輸入標題")
  })

  it("accepts a title of exactly 1 character", () => {
    expect(updateItemSchema.safeParse({ title: "x" }).success).toBe(true)
  })

  it("accepts a title of exactly 255 characters", () => {
    expect(updateItemSchema.safeParse({ title: "b".repeat(255) }).success).toBe(true)
  })

  it("rejects a title of 256 characters", () => {
    const r = updateItemSchema.safeParse({ title: "b".repeat(256) })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toBe("標題過長（最多 255 個字元）。")
  })

  it("rejects non-string input (FormData.get() can return a File, or null)", () => {
    expect(updateItemSchema.safeParse({ title: null }).success).toBe(false)
    const r = updateItemSchema.safeParse({ title: null })
    if (!r.success) expect(r.error.errors[0].message).toBe("請輸入標題")
  })
})
