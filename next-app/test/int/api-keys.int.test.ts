/**
 * api-keys.int.test.ts — actions/api-keys.ts wiring against a REAL throwaway
 * Postgres DB (E349). Covers createApiKey (login-only, requireAuth),
 * exportApiKeys (requireAdmin), and revokeApiKey (owner-scoped update).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  isPostgresReachable,
  seedUser,
  setupTestDb,
  teardownTestDb,
  truncateDomain,
  type TestDb,
} from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn(
    "⏭ SKIP next-app/test/int/api-keys.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

let actorId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (actorId ? { user: { id: actorId } } : null),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
})
vi.mock("next/navigation", () => ({ redirect: redirectMock }))

async function countApiKeys(tdb: TestDb): Promise<number> {
  const rows = await tdb.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM api_keys`
  return rows[0].n
}

describe.skipIf(!reachable)("actions/api-keys.ts wiring (int)", () => {
  let tdb: TestDb
  let apiKeys: typeof import("@/actions/api-keys")

  beforeAll(async () => {
    tdb = await setupTestDb()
    apiKeys = await import("@/actions/api-keys")
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    redirectMock.mockClear()
    await truncateDomain(["api_keys", "audit_log", "users"])
  })

  describe("createApiKey", () => {
    it("unauthenticated caller is blocked — redirected to /login, no row written", async () => {
      actorId = null
      await expect(apiKeys.createApiKey("My Key")).rejects.toThrow("NEXT_REDIRECT:/login")
      expect(redirectMock).toHaveBeenCalledWith("/login")
      expect(await countApiKeys(tdb)).toBe(0)
    })

    it("any logged-in role (viewer) may create — row written + audit entry, plaintext returned once", async () => {
      const viewer = await seedUser({ email: "viewer@int.test", role: "viewer" })
      actorId = viewer.id

      const result = await apiKeys.createApiKey("My Key")
      expect(result.plaintext).toMatch(/^sk_/)
      expect(result.error).toBeUndefined()

      const rows = await tdb.sql<{ user_id: string; name: string }[]>`
        SELECT user_id, name FROM api_keys WHERE user_id = ${viewer.id}
      `
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toBe("My Key")

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'api_key.created'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("exportApiKeys", () => {
    it("editor is blocked — returns a failure result (not admin)", async () => {
      const editor = await seedUser({ email: "editor@int.test", role: "editor" })
      actorId = editor.id

      const result = await apiKeys.exportApiKeys()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it("admin: returns CSV data, and the secret is never included", async () => {
      const admin = await seedUser({ email: "admin@int.test", role: "admin" })
      actorId = admin.id
      await apiKeys.createApiKey("Exportable Key")

      const result = await apiKeys.exportApiKeys()
      expect(result).toMatchObject({ success: true, contentType: "text/csv" })
      if (result.success) {
        expect(result.data).toContain("Exportable Key")
        expect(result.data).not.toMatch(/sk_[A-Za-z0-9_-]{20,}/) // no plaintext/hashed secret leaks
      }
    })
  })

  describe("revokeApiKey", () => {
    it("a non-owner's revoke call has ZERO effect — the key stays active", async () => {
      const owner = await seedUser({ email: "owner@int.test", role: "viewer" })
      const attacker = await seedUser({ email: "attacker@int.test", role: "viewer" })

      actorId = owner.id
      await apiKeys.createApiKey("Owned Key")
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM api_keys WHERE user_id = ${owner.id}
      `

      actorId = attacker.id // IDOR attempt — different user, same key id
      await apiKeys.revokeApiKey(row.id)

      const after = await tdb.sql<{ revoked_at: Date | null }[]>`
        SELECT revoked_at FROM api_keys WHERE id = ${row.id}
      `
      expect(after[0].revoked_at).toBeNull()
    })

    it("owner: revokes their own key — revoked_at set + audit entry", async () => {
      const owner = await seedUser({ email: "owner2@int.test", role: "editor" })
      actorId = owner.id
      await apiKeys.createApiKey("To Revoke")
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM api_keys WHERE user_id = ${owner.id}
      `

      const result = await apiKeys.revokeApiKey(row.id)
      expect(result.error).toBeUndefined()

      const after = await tdb.sql<{ revoked_at: Date | null }[]>`
        SELECT revoked_at FROM api_keys WHERE id = ${row.id}
      `
      expect(after[0].revoked_at).not.toBeNull()

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'api_key.revoked'
      `
      expect(audits[0].n).toBe(1)
    })
  })
})
