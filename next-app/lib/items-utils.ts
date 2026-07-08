// Pure item helpers — NO db import (unit-testable in isolation).

const MAX_TITLE_LENGTH = 255

/**
 * Validates a raw item title from form input.
 * Returns the trimmed title on success, or an error string on failure.
 */
export function validateItemTitle(raw: unknown): { title: string } | { error: string } {
  if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
    return { error: "請輸入標題" }
  }
  if (raw.trim().length > MAX_TITLE_LENGTH) {
    return { error: "標題過長（最多 255 個字元）。" }
  }
  return { title: raw.trim() }
}
