"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/permissions"
import { apiKeysTable } from "@/lib/schema"
import { generateApiKey } from "@/lib/api-keys-utils"
import { logAudit } from "@/lib/audit"

/** Create an API key for the current user. Returns the plaintext ONCE. */
export async function createApiKey(name: string): Promise<{ plaintext?: string; error?: string }> {
  const session = await requireAuth()
  const trimmed = name?.trim()
  if (!trimmed) return { error: "請輸入金鑰名稱。" }

  const { plaintext, prefix, hashedKey } = generateApiKey()
  await db.insert(apiKeysTable).values({ userId: session.user.id, name: trimmed, prefix, hashedKey })
  await logAudit({ actorId: session.user.id, action: "api_key.created", targetType: "api_key", metadata: { name: trimmed, prefix } })

  revalidatePath("/dashboard/system")
  return { plaintext }
}

/** Revoke one of the current user's API keys (owner-scoped). */
export async function revokeApiKey(id: string): Promise<{ error?: string }> {
  const session = await requireAuth()
  await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, session.user.id)))
  await logAudit({ actorId: session.user.id, action: "api_key.revoked", targetType: "api_key", targetId: id })

  revalidatePath("/dashboard/system")
  return {}
}
