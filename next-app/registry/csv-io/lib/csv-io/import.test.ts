import { describe, expect, it } from "vitest"

import { parseCsv, type ParseRowResult } from "./import"

interface Row {
  key: string
  name: string
}

function headerKey(raw: string): string | null {
  const h = raw.trim().toLowerCase()
  if (h === "key") return "key"
  if (h === "name") return "name"
  return null
}

function parseRow(cells: Record<string, string>): ParseRowResult<Row> {
  if (!cells.key) return { success: false, reason: "key is required" }
  if (!cells.name) return { success: false, reason: "name is required" }
  return { success: true, data: { key: cells.key, name: cells.name } }
}

describe("parseCsv", () => {
  it("parses a simple file into validated rows", () => {
    const result = parseCsv("key,name\nu1,Alice\nu2,Bob\n", { headerKey, requiredKeys: ["key", "name"], parseRow })
    expect(result.errors).toEqual([])
    expect(result.truncated).toBe(false)
    expect(result.rows).toEqual([
      { key: "u1", name: "Alice" },
      { key: "u2", name: "Bob" },
    ])
  })

  it("strips a leading BOM and normalizes CRLF", () => {
    const result = parseCsv("﻿key,name\r\nu1,Alice\r\n", { headerKey, requiredKeys: ["key", "name"], parseRow })
    expect(result.rows).toEqual([{ key: "u1", name: "Alice" }])
  })

  it("skips blank lines without consuming a row number", () => {
    const result = parseCsv("key,name\nu1,Alice\n\nu2,Bob\n", { headerKey, requiredKeys: ["key", "name"], parseRow })
    expect(result.rows.map((r) => r.key)).toEqual(["u1", "u2"])
  })

  it("handles RFC-4180 quoted cells with embedded commas and escaped quotes", () => {
    const result = parseCsv('key,name\nu1,"Smith, ""Al"""\n', {
      headerKey,
      requiredKeys: ["key", "name"],
      parseRow,
    })
    expect(result.rows).toEqual([{ key: "u1", name: 'Smith, "Al"' }])
  })

  it("collects per-row errors without aborting the parse", () => {
    const result = parseCsv("key,name\nu1,Alice\n,\nu2,Bob\n", {
      headerKey,
      requiredKeys: ["key", "name"],
      parseRow,
    })
    expect(result.rows).toEqual([
      { key: "u1", name: "Alice" },
      { key: "u2", name: "Bob" },
    ])
    expect(result.errors).toEqual([{ row: 2, reason: "key is required" }])
  })

  it("short-circuits on a missing required column", () => {
    const result = parseCsv("name\nAlice\n", { headerKey, requiredKeys: ["key", "name"], parseRow })
    expect(result.rows).toEqual([])
    expect(result.errors).toEqual([{ row: 0, reason: "Missing required column: key" }])
  })

  it("short-circuits on empty content", () => {
    const result = parseCsv("   \n\n", { headerKey, requiredKeys: ["key", "name"], parseRow })
    expect(result.errors).toEqual([{ row: 0, reason: "CSV content is empty" }])
  })

  it("truncates beyond maxRows without emitting an error for the excess rows", () => {
    const text = "key,name\n" + Array.from({ length: 5 }, (_, i) => `u${i},Name${i}`).join("\n")
    const result = parseCsv(text, { headerKey, requiredKeys: ["key", "name"], parseRow, maxRows: 3 })
    expect(result.rows).toHaveLength(3)
    expect(result.truncated).toBe(true)
    expect(result.errors).toEqual([])
  })
})
