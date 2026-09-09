"use server"

import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { requireAdmin, requireAuth } from "@/lib/permissions"
import { apiKeysTable } from "@/lib/schema"
import { generateApiKey } from "@/lib/api-keys-utils"
import { logAudit } from "@/lib/audit"
import { rateLimitGuard } from "@/lib/rate-limit"
import { toCsv } from "@/lib/export-utils"
import { apiKeyToExportRow } from "@/lib/export-row-mappers"

const MINUTE_MS = 60_000

/** Create an API key for the current user. Returns the plaintext ONCE. */
export async function createApiKey(name: string): Promise<{ plaintext?: string; error?: string }> {
  const session = await requireAuth()

  const limited = rateLimitGuard(`apikey:create:${session.user.id}`, 10, MINUTE_MS)
  if (limited) return limited

  const trimmed = name?.trim()
  if (!trimmed) return { error: "請輸入金鑰名稱。" }
  if (trimmed.length > 100) return { error: "金鑰名稱過長（最多 100 個字元）。" }

  const { plaintext, prefix, hashedKey } = generateApiKey()
  await db.insert(apiKeysTable).values({ userId: session.user.id, name: trimmed, prefix, hashedKey })
  await logAudit({ actorId: session.user.id, action: "api_key.created", targetType: "api_key", metadata: { name: trimmed, prefix } })

  revalidatePath("/dashboard/system")
  return { plaintext }
}

/**
 * Export all API keys for the current user as CSV (admin only).
 * SECURITY: the raw secret and hashed key are NEVER exported.
 * Only prefix + metadata is included.
 */
export async function exportApiKeys(): Promise<
  | { success: true; data: string; filename: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    await requireAdmin()
  } catch {
    return { success: false, error: "權限不足。" }
  }

  const rows = await db
    .select({
      id: apiKeysTable.id,
      userId: apiKeysTable.userId,
      name: apiKeysTable.name,
      prefix: apiKeysTable.prefix,
      scopes: apiKeysTable.scopes,
      lastUsedAt: apiKeysTable.lastUsedAt,
      revokedAt: apiKeysTable.revokedAt,
      createdAt: apiKeysTable.createdAt,
    })
    .from(apiKeysTable)
    .orderBy(desc(apiKeysTable.createdAt))

  const exportRows = rows.map(apiKeyToExportRow)
  const headers = ["id", "userId", "name", "prefix", "scopes", "lastUsedAt", "revokedAt", "createdAt"]
  const data = toCsv(exportRows, headers)
  const filename = `api-keys-${new Date().toISOString().slice(0, 10)}.csv`

  return { success: true, data, filename, contentType: "text/csv" }
}

/** Revoke one of the current user's API keys (owner-scoped). */
export async function revokeApiKey(id: string): Promise<{ error?: string }> {
  const session = await requireAuth()

  const limited = rateLimitGuard(`apikey:revoke:${session.user.id}`, 10, MINUTE_MS)
  if (limited) return limited

  const result = await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, session.user.id)))

  // E368 — an ownership-scoped WHERE matching zero rows means the key does not
  // exist or belongs to someone else. Returning success here did two bad things:
  // the UI showed a revocation that never happened, AND the audit write below
  // ran anyway — letting any authenticated caller inject a forged
  // `api_key.revoked` entry naming a resource they cannot touch. The audit
  // write MUST stay after this check.
  if (result.count === 0) {
    return { error: "找不到金鑰，或您沒有權限撤銷。" }
  }

  await logAudit({ actorId: session.user.id, action: "api_key.revoked", targetType: "api_key", targetId: id })

  revalidatePath("/dashboard/system")
  return {}
}
