import { describe, expect, it } from "vitest"
import { toCsv, toJson } from "@/lib/export-utils"

// ---------------------------------------------------------------------------
// toCsv
// ---------------------------------------------------------------------------

describe("toCsv", () => {
  it("returns empty string for empty rows and no explicit headers", () => {
    expect(toCsv([])).toBe("")
  })

  it("returns empty string when explicit headers is an empty array", () => {
    expect(toCsv([], [])).toBe("")
  })

  it("serialises a single row with explicit headers", () => {
    const rows = [{ id: "1", name: "Alice" }]
    const csv = toCsv(rows, ["id", "name"])
    expect(csv).toBe("id,name\r\n1,Alice")
  })

  it("uses row keys as headers when headers param is omitted", () => {
    const rows = [{ a: "1", b: "2" }]
    const csv = toCsv(rows)
    expect(csv).toBe("a,b\r\n1,2")
  })

  it("escapes values that contain commas", () => {
    const rows = [{ title: "Hello, World" }]
    const csv = toCsv(rows, ["title"])
    expect(csv).toBe('title\r\n"Hello, World"')
  })

  it("escapes values that contain double-quotes", () => {
    const rows = [{ title: 'Say "Hi"' }]
    const csv = toCsv(rows, ["title"])
    expect(csv).toBe('title\r\n"Say ""Hi"""')
  })

  it("escapes values that contain newlines", () => {
    const rows = [{ notes: "line1\nline2" }]
    const csv = toCsv(rows, ["notes"])
    expect(csv).toBe('notes\r\n"line1\nline2"')
  })

  it("handles unicode characters without escaping", () => {
    const rows = [{ name: "日本語テスト 🎉" }]
    const csv = toCsv(rows, ["name"])
    expect(csv).toBe("name\r\n日本語テスト 🎉")
  })

  it("renders null/undefined cells as empty strings", () => {
    const rows = [{ a: null, b: undefined, c: 0 }] as Record<string, unknown>[]
    const csv = toCsv(rows, ["a", "b", "c"])
    expect(csv).toBe("a,b,c\r\n,,0")
  })

  it("produces correct CRLF line endings for multiple rows", () => {
    const rows = [
      { x: "1", y: "a" },
      { x: "2", y: "b" },
    ]
    const csv = toCsv(rows, ["x", "y"])
    expect(csv).toBe("x,y\r\n1,a\r\n2,b")
  })
})

// ---------------------------------------------------------------------------
// toJson
// ---------------------------------------------------------------------------

describe("toJson", () => {
  it("serialises an empty array", () => {
    expect(toJson([])).toBe("[]")
  })

  it("pretty-prints with 2-space indent", () => {
    const result = toJson([{ id: 1, name: "Alice" }])
    expect(result).toContain("\n")
    // First property should be indented 2 spaces
    expect(result).toContain('  "id"')
  })

  it("handles unicode characters", () => {
    const result = toJson([{ name: "繁體中文" }])
    expect(result).toContain("繁體中文")
  })

  it("handles nested structures", () => {
    const result = toJson([{ meta: { key: "value" } }])
    expect(JSON.parse(result)).toEqual([{ meta: { key: "value" } }])
  })
})
