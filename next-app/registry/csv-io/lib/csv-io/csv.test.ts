import { describe, expect, it } from "vitest"

import { escapeCsvCell, toCsv } from "./csv"

describe("escapeCsvCell", () => {
  it("returns empty string for null/undefined", () => {
    expect(escapeCsvCell(null)).toBe("")
    expect(escapeCsvCell(undefined)).toBe("")
  })

  it("passes plain values through unquoted", () => {
    expect(escapeCsvCell("plain")).toBe("plain")
    expect(escapeCsvCell(42)).toBe("42")
  })

  it("quotes and doubles embedded quotes when needed", () => {
    expect(escapeCsvCell('has "quotes"')).toBe('"has ""quotes"""')
    expect(escapeCsvCell("a,b")).toBe('"a,b"')
    expect(escapeCsvCell("line\nbreak")).toBe('"line\nbreak"')
  })
})

describe("toCsv", () => {
  it("joins header + rows with CRLF and a leading BOM", () => {
    const csv = toCsv(["name", "role"], [["Alice", "admin"], ["Bob", "editor"]])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toBe("﻿name,role\r\nAlice,admin\r\nBob,editor")
  })

  it("pads missing cells with empty strings", () => {
    const csv = toCsv(["a", "b"], [["only-a"]])
    expect(csv).toBe("﻿a,b\r\nonly-a")
  })
})
