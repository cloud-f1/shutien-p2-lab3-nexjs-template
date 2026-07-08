// @saas/csv-io — generic CSV import: parse + per-row validate + row cap (E325).
//
// Ported from a fork's user-roster CSV importer, generalized off any single record
// shape: the caller supplies a header-name → field-key mapper and a per-row
// validator/coercer (e.g. a Zod `safeParse` call), instead of this module hardcoding
// column names or a Zod schema. Upsert-by-key semantics (insert vs. update, uniqueness
// enforcement) belong to the caller's Server Action — this module only parses and
// validates rows; it never touches the database.
//
// PURE — no db import — independently unit-testable. Tolerant of a UTF-8 BOM, CRLF/LF
// line endings, RFC-4180 quote escaping (`"a,b"`, `""` → `"`), and blank lines (which
// do not consume a row number).

export interface RowError {
  /** 1-based data-row number (header excluded; blank lines don't consume a number). */
  row: number
  reason: string
}

export type ParseRowResult<T> = { success: true; data: T } | { success: false; reason: string }

export interface ParseCsvOptions<T> {
  /** Maps one normalized header cell to an internal field key, or `null` to ignore the column. */
  headerKey: (rawHeader: string) => string | null
  /** Internal field keys that MUST be present in the header — a missing one is a whole-file error. */
  requiredKeys: readonly string[]
  /**
   * Validate + coerce one row's `{ fieldKey: rawCellValue }` map (all values are
   * trimmed strings). Return `{ success: false, reason }` to record a per-row error
   * without aborting the rest of the parse — e.g. wrap a Zod `safeParse`.
   */
  parseRow: (cells: Record<string, string>, rowNumber: number) => ParseRowResult<T>
  /** Max data rows accepted before the parse stops (protects against pathological uploads). Default 1000. */
  maxRows?: number
}

export interface ParseCsvResult<T> {
  rows: T[]
  errors: RowError[]
  /** True when `maxRows` was hit — rows beyond the cap were NOT parsed (not counted as errors). */
  truncated: boolean
}

/** Split one CSV line into raw cells (RFC-4180: quote-wrapped fields, `""` escapes a literal quote). */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      out.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

/**
 * Parse `text` into validated rows + per-row errors, per `options`.
 *
 * - The first non-blank line is the header; every other non-blank line is a data row.
 * - A blank line is skipped and does not consume a row number.
 * - Missing a `requiredKeys` column, or an entirely empty file, short-circuits with a
 *   single `row: 0` error and no parsed rows.
 * - Per-row validation failures are collected in `errors` — the parse does not abort.
 */
export function parseCsv<T>(text: string, options: ParseCsvOptions<T>): ParseCsvResult<T> {
  const maxRows = options.maxRows ?? 1000
  const rows: T[] = []
  const errors: RowError[] = []

  // Strip a leading UTF-8 BOM and normalize CRLF/CR to LF.
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n")
  const rawLines = clean.split("\n")

  let headerIdx = -1
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].trim() !== "") {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) {
    return { rows, errors: [{ row: 0, reason: "CSV content is empty" }], truncated: false }
  }

  const headerCells = splitCsvLine(rawLines[headerIdx])
  const colIndex: Record<string, number> = {}
  headerCells.forEach((cell, idx) => {
    const key = options.headerKey(cell)
    if (key && colIndex[key] === undefined) colIndex[key] = idx
  })

  for (const key of options.requiredKeys) {
    if (colIndex[key] === undefined) {
      return { rows, errors: [{ row: 0, reason: `Missing required column: ${key}` }], truncated: false }
    }
  }

  let dataRow = 0
  let truncated = false
  for (let i = headerIdx + 1; i < rawLines.length; i++) {
    if (rawLines[i].trim() === "") continue // blank line — doesn't consume a row number
    if (dataRow >= maxRows) {
      truncated = true
      break
    }
    dataRow++

    const cells = splitCsvLine(rawLines[i])
    const record: Record<string, string> = {}
    for (const [key, idx] of Object.entries(colIndex)) {
      record[key] = (cells[idx] ?? "").trim()
    }

    const parsed = options.parseRow(record, dataRow)
    if (!parsed.success) {
      errors.push({ row: dataRow, reason: parsed.reason })
      continue
    }
    rows.push(parsed.data)
  }

  return { rows, errors, truncated }
}
