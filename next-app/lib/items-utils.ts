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

/**
 * Ownership check: returns null if the actor owns the item, or an error
 * message if the IDs differ (caller should surface the error without
 * leaking whether the item actually exists).
 */
export function assertItemOwner(
  actorId: string,
  itemOwnerId: string,
  action: "edit" | "delete" = "edit",
): string | null {
  if (actorId !== itemOwnerId) {
    return action === "delete"
      ? "找不到項目，或您沒有權限刪除。"
      : "找不到項目，或您沒有權限編輯。"
  }
  return null
}

/**
 * Role gate for write operations on items.
 * Returns null if the role is allowed to write (admin or editor),
 * or an error string if the role is viewer / unknown.
 */
export function assertCanWriteItems(role: string | undefined): string | null {
  if (role === "admin" || role === "editor") return null
  return "權限不足：需要編輯者或管理員角色。"
}
