// @saas/csv-io — CSV export helpers (E325).
//
// Ported directly (no domain logic to generalize): RFC-4180-ish quoting +
// a UTF-8 BOM so Excel opens the file with the correct encoding. Pure — no db
// import — used by both export and import (import re-parses raw lines, not this
// function, but shares the same escaping contract).

/** Escape a single CSV cell: wrap in quotes (doubling embedded quotes) iff it contains a comma, quote, or newline. */
export function escapeCsvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Compose `header` + `rows` into a CSV string with a UTF-8 BOM (so Excel renders
 * non-ASCII text correctly) and CRLF line endings. Rows may have fewer cells than
 * `header` — missing cells render as empty.
 */
export function toCsv(header: string[], rows: (readonly unknown[])[]): string {
  const lines: string[] = []
  lines.push(header.map(escapeCsvCell).join(","))
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","))
  }
  return "﻿" + lines.join("\r\n")
}
