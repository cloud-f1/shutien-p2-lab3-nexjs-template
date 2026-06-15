// Pure team/invitation helpers — NO db import (unit-testable in isolation).
import { randomBytes } from "node:crypto"

import type { Role } from "@/lib/schema"

const INVITE_TTL_DAYS = 7

/** Opaque, URL-safe invitation token. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url")
}

/** Expiry timestamp for a freshly-minted invite, given "now". */
export function inviteExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
}

/** An invite is acceptable only while pending and unexpired. */
export function isInviteValid(
  invite: { status: string; expiresAt: Date },
  now: Date,
): boolean {
  return invite.status === "pending" && invite.expiresAt.getTime() > now.getTime()
}

/** Capabilities gated by role — drives both the matrix UI and `can()`. */
export const CAPABILITIES = [
  { key: "items.read", label: "檢視內容" },
  { key: "items.write", label: "建立／編輯內容" },
  { key: "items.delete", label: "刪除內容" },
  { key: "members.manage", label: "管理成員與角色" },
  { key: "billing.manage", label: "管理帳務" },
  { key: "system.audit", label: "檢視稽核紀錄" },
] as const

export type Capability = (typeof CAPABILITIES)[number]["key"]

/** role → capability → allowed. The single source of truth for the matrix. */
export const PERMISSION_MATRIX: Record<Role, Record<Capability, boolean>> = {
  admin: {
    "items.read": true,
    "items.write": true,
    "items.delete": true,
    "members.manage": true,
    "billing.manage": true,
    "system.audit": true,
  },
  editor: {
    "items.read": true,
    "items.write": true,
    "items.delete": true,
    "members.manage": false,
    "billing.manage": false,
    "system.audit": false,
  },
  viewer: {
    "items.read": true,
    "items.write": false,
    "items.delete": false,
    "members.manage": false,
    "billing.manage": false,
    "system.audit": false,
  },
}

/** Does `role` have `capability`? Unknown roles/capabilities → false. */
export function can(role: Role | string | undefined, capability: Capability): boolean {
  if (!role) return false
  return PERMISSION_MATRIX[role as Role]?.[capability] ?? false
}
