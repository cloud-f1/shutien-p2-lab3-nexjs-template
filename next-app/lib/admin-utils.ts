// Pure admin helpers — NO db import (unit-testable in isolation).
import type { Role } from "@/lib/schema"

const VALID_ROLES: Role[] = ["admin", "editor", "viewer"]

/** Returns true if the given string is a known role. */
export function isValidRole(role: unknown): role is Role {
  return typeof role === "string" && (VALID_ROLES as string[]).includes(role)
}

/**
 * Guards the "change own role" self-action.
 * Returns an error string if the actor is targeting themselves, null if OK.
 */
export function assertNotSelf(actorId: string, targetId: string): string | null {
  if (actorId === targetId) {
    return "您無法變更自己的角色。"
  }
  return null
}

/**
 * Guards the "delete own account" self-action.
 * Returns an error string if the actor is targeting themselves, null if OK.
 */
export function assertNotSelfDelete(actorId: string, targetId: string): string | null {
  if (actorId === targetId) {
    return "您無法刪除自己的帳戶。"
  }
  return null
}
