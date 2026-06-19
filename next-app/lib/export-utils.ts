/**
 * E299 — Pure export helpers (db-free).
 *
 * toCsv  — converts an array of records to an RFC-4180-compliant CSV string.
 * toJson — converts an array to a pretty-printed JSON string.
 *
 * Both functions are synchronous and have no side-effects.
 */

/**
 * Escape a single cell value per RFC 4180:
 *  - Wrap in double-quotes if the value contains a comma, double-quote, newline, or CR.
 *  - Double any embedded double-quote characters.
 */
function escapeCsvCell(value: unknown): string {
  const str = value == null ? "" : String(value)
  // Must quote if contains comma, double-quote, LF, or CR
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert an array of records to a RFC-4180 CSV string.
 *
 * @param rows    Array of records (each row is a key→value map).
 * @param headers Column headers (also used as keys to extract values from rows).
 *                 If omitted, the keys of the first row are used; empty array → empty string.
 * @returns       A UTF-8 CSV string including a header row and CRLF line endings.
 */
export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  const cols = headers ?? (rows.length > 0 ? Object.keys(rows[0]) : [])
  if (cols.length === 0) return ""

  const lines: string[] = [cols.map(escapeCsvCell).join(",")]
  for (const row of rows) {
    lines.push(cols.map((col) => escapeCsvCell(row[col])).join(","))
  }
  return lines.join("\r\n")
}

/**
 * Convert an array to a pretty-printed JSON string.
 *
 * @param rows Any serialisable array.
 * @returns    Indented JSON string (2-space indent).
 */
export function toJson(rows: unknown[]): string {
  return JSON.stringify(rows, null, 2)
}
