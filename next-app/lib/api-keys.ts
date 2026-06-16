import { and, desc, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { apiKeysTable, usersTable, type ApiKey, type Role } from "@/lib/schema"
import { hashEquals, hashKey, parseApiKey } from "@/lib/api-keys-utils"

export { generateApiKey, hashKey, parseApiKey, hashEquals } from "@/lib/api-keys-utils"

/** List a user's keys (newest first), never selecting the hash. */
export async function listApiKeys(userId: string): Promise<Omit<ApiKey, "hashedKey">[]> {
  return db
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
    .where(eq(apiKeysTable.userId, userId))
    .orderBy(desc(apiKeysTable.createdAt))
}

/**
 * Verify a bearer API key. Returns the owning user (id+role) plus the key's
 * granted scopes, or null when the key is missing / malformed / revoked /
 * unknown. Bumps lastUsedAt on success.
 *
 * The returned `scopes` are the key's own grants (not the user's role) — the
 * public REST API (E291) enforces them per-request via lib/api-auth-utils.
 */
export async function verifyApiKey(
  bearer: string | null | undefined,
): Promise<{ userId: string; role: Role; scopes: string[] } | null> {
  const parsed = parseApiKey(bearer)
  if (!parsed) return null

  const [row] = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.prefix, parsed.prefix), isNull(apiKeysTable.revokedAt)))
    .limit(1)
  if (!row || !hashEquals(row.hashedKey, hashKey(parsed.secret))) return null

  await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, row.id))
  const [user] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, row.userId))
    .limit(1)
  return user ? { userId: row.userId, role: user.role, scopes: row.scopes } : null
}
