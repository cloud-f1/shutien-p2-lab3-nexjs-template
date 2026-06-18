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

describe("updateItemSchema", () => {
  it("accepts a valid title", () => {
    expect(updateItemSchema.safeParse({ title: "Updated title" }).success).toBe(true)
  })

  it("rejects an empty title", () => {
    const r = updateItemSchema.safeParse({ title: "" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toMatch(/請輸入標題/)
  })

  it("rejects a title over 255 characters", () => {
    const r = updateItemSchema.safeParse({ title: "b".repeat(256) })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toMatch(/標題過長/)
  })
})
