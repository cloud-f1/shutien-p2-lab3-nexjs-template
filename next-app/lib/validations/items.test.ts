import { describe, expect, it } from "vitest"
import { createItemSchema, updateItemSchema } from "./items"

// E352 — createItemSchema is now the SINGLE validation contract for createItem()
// (actions/items.ts calls .safeParse() directly, trimming first — the removed
// hand-rolled validateItemTitle() previously did that). These boundary tests pin
// the exact accept/reject behavior + error text, including the max-length message
// normalized in this epic from "標題過長" to "標題過長（最多 255 個字元）。" to
// match updateItemSchema (see docs/epics/e352-create-item-contract-symmetry.md).
describe("createItemSchema", () => {
  it("accepts a valid title", () => {
    expect(createItemSchema.safeParse({ title: "My item" }).success).toBe(true)
  })

  it("accepts a title of exactly 1 character", () => {
    expect(createItemSchema.safeParse({ title: "x" }).success).toBe(true)
  })

  it("rejects an empty title", () => {
    const r = createItemSchema.safeParse({ title: "" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toBe("請輸入標題")
  })

  it("accepts a title of exactly 255 characters", () => {
    expect(createItemSchema.safeParse({ title: "a".repeat(255) }).success).toBe(true)
  })

  it("rejects a title of 256 characters", () => {
    const r = createItemSchema.safeParse({ title: "a".repeat(256) })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toBe("標題過長（最多 255 個字元）。")
  })

  it("rejects non-string input (FormData.get() can return a File, or null)", () => {
    expect(createItemSchema.safeParse({ title: null }).success).toBe(false)
    const r = createItemSchema.safeParse({ title: null })
    if (!r.success) expect(r.error.errors[0].message).toBe("請輸入標題")
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

// E352 — create and update must produce IDENTICAL accept/reject and error text
// for the same input, now that both share `itemTitleSchema`
// (lib/validations/items.ts). Boundary set per the epic acceptance criteria:
// "" · " " (single space) · "a" · 255 chars · 256 chars · null · a File-shaped
// value (simulated — Zod only sees the object shape, not a real File instance).
describe("createItemSchema and updateItemSchema produce identical results", () => {
  const cases: Array<{ label: string; title: unknown }> = [
    { label: "empty string", title: "" },
    { label: "single space", title: " " },
    { label: "single character", title: "a" },
    { label: "255 characters", title: "a".repeat(255) },
    { label: "256 characters", title: "a".repeat(256) },
    { label: "null", title: null },
    { label: "non-string (number, standing in for a File)", title: 42 },
  ]

  for (const { label, title } of cases) {
    it(`${label}: same success + same message`, () => {
      const c = createItemSchema.safeParse({ title })
      const u = updateItemSchema.safeParse({ title })
      expect(c.success).toBe(u.success)
      if (!c.success && !u.success) {
        expect(c.error.errors[0].message).toBe(u.error.errors[0].message)
      }
    })
  }
})

// E352 — the schema alone does NOT trim (a bare " " has length 1 and passes
// .min(1)); both createItem() and updateItem() in actions/items.ts trim the
// raw FormData value first (`typeof raw === "string" ? raw.trim() : raw`)
// before calling `.safeParse()`. This block reproduces that exact composition
// so the whitespace-only boundary — the one E348 found create/update secretly
// disagreeing on — is exercised the way the real actions exercise it, for
// both schemas, over the full boundary set the epic specifies:
// "" · " " · "a" · 255 · 256 · null · a File-shaped value.
function trimThenParse(schema: typeof createItemSchema, raw: unknown) {
  return schema.safeParse({ title: typeof raw === "string" ? raw.trim() : raw })
}

describe("trim-then-parse composition (mirrors actions/items.ts)", () => {
  const cases: Array<{ label: string; raw: unknown }> = [
    { label: "empty string", raw: "" },
    { label: "single space (must be rejected once trimmed)", raw: " " },
    { label: "single character", raw: "a" },
    { label: "255 characters", raw: "a".repeat(255) },
    { label: "256 characters", raw: "a".repeat(256) },
    { label: "null", raw: null },
    { label: "non-string (number, standing in for a File)", raw: 42 },
  ]

  for (const { label, raw } of cases) {
    it(`${label}: createItemSchema and updateItemSchema agree`, () => {
      const c = trimThenParse(createItemSchema, raw)
      const u = trimThenParse(updateItemSchema, raw)
      expect(c.success).toBe(u.success)
      if (!c.success && !u.success) {
        expect(c.error.errors[0].message).toBe(u.error.errors[0].message)
      }
    })
  }

  it("single space is rejected (trimmed to empty) — the exact case E348 flagged", () => {
    const c = trimThenParse(createItemSchema, " ")
    const u = trimThenParse(updateItemSchema, " ")
    expect(c.success).toBe(false)
    expect(u.success).toBe(false)
    if (!c.success) expect(c.error.errors[0].message).toBe("請輸入標題")
    if (!u.success) expect(u.error.errors[0].message).toBe("請輸入標題")
  })
})

// Lab 3 (course-ai-coding-advanced-shutien, ch03-lab3) — note field validation
// contract: optional, max 200 chars, must not be entirely composed of symbol
// characters. As of this commit, createItemSchema/updateItemSchema have NO
// `note` field at all. Zod's z.object() silently DROPS unknown keys by
// default, so a naive `expect(result.success).toBe(true/false)` assertion
// would NOT go red here — success stays true either way. These 3 tests
// assert on data retention / rejection instead, which DOES go red against
// today's schema (data.note is undefined; success stays true for the
// too-long and all-symbol cases because the field doesn't exist to reject).
describe("note field (RED — not implemented yet)", () => {
  it("retains a legit note in data.note", () => {
    const r = createItemSchema.safeParse({ title: "My item", note: "需回診複診" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.note).toBe("需回診複診")
  })

  it("rejects a 201-character note", () => {
    const r = createItemSchema.safeParse({ title: "My item", note: "a".repeat(201) })
    expect(r.success).toBe(false)
  })

  it("rejects a note made entirely of symbol characters", () => {
    const r = createItemSchema.safeParse({ title: "My item", note: "!!!@@@###$$$" })
    expect(r.success).toBe(false)
  })
})
