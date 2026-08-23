/**
 * webhooks.int.test.ts — actions/webhooks.ts wiring against a REAL throwaway
 * Postgres DB (E349). Covers all 9 mutations:
 *   user-scoped: createWebhook, setWebhookActive, deleteWebhook, exportWebhooks,
 *     sendTestEvent
 *   system-scoped (E330, admin-only via a hand-rolled ensureAdmin() that
 *     try/catches requireAdmin() into a plain {error} instead of a thrown
 *     redirect): createSystemWebhook, setSystemWebhookActive,
 *     deleteSystemWebhook, sendSystemTestEvent
 *
 * `@/lib/webhooks`'s `deliverToEndpoint` makes a real outbound `fetch` with
 * retry/backoff — mocked here (a network boundary, not core logic) so the
 * *-TestEvent tests are fast and deterministic; `generateWebhookSecret` is
 * passed through to the real implementation since it's pure.
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
    "⏭ SKIP next-app/test/int/webhooks.int.test.ts — no reachable Postgres. " +
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

const deliverToEndpoint = vi.fn(async () => ({
  status: "success" as const,
  responseCode: 200,
  attempts: 1,
}))
vi.mock("@/lib/webhooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/webhooks")>()
  return { ...actual, deliverToEndpoint: (...a: unknown[]) => deliverToEndpoint(...(a as [])) }
})

async function countWebhooks(tdb: TestDb, scope: "user" | "system"): Promise<number> {
  const rows = await tdb.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM webhooks WHERE scope = ${scope}
  `
  return rows[0].n
}

describe.skipIf(!reachable)("actions/webhooks.ts wiring (int)", () => {
  let tdb: TestDb
  let webhooks: typeof import("@/actions/webhooks")

  beforeAll(async () => {
    tdb = await setupTestDb()
    webhooks = await import("@/actions/webhooks")
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    redirectMock.mockClear()
    deliverToEndpoint.mockClear()
    await truncateDomain(["audit_log", "webhook_deliveries", "webhooks", "users"])
  })

  // -------------------------------------------------------------------------
  // User-scoped
  // -------------------------------------------------------------------------

  describe("createWebhook", () => {
    it("unauthenticated caller is blocked — redirected to /login, no row written", async () => {
      actorId = null
      await expect(
        webhooks.createWebhook({ url: "https://example.com/hook", events: ["*"] }),
      ).rejects.toThrow("NEXT_REDIRECT:/login")
      expect(await countWebhooks(tdb, "user")).toBe(0)
    })

    it("any logged-in role (viewer): creates a user-scoped webhook + audit entry", async () => {
      const viewer = await seedUser({ email: "viewer@int.test", role: "viewer" })
      actorId = viewer.id

      const result = await webhooks.createWebhook({
        url: "https://example.com/hook",
        events: ["user.created"],
      })
      expect(result.secret).toBeDefined()

      const rows = await tdb.sql<{ user_id: string; scope: string }[]>`
        SELECT user_id, scope FROM webhooks WHERE user_id = ${viewer.id}
      `
      expect(rows).toHaveLength(1)
      expect(rows[0].scope).toBe("user")

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'webhook.created'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("setWebhookActive", () => {
    it("a non-owner's toggle has ZERO effect", async () => {
      const owner = await seedUser({ email: "owner@int.test", role: "viewer" })
      const attacker = await seedUser({ email: "attacker@int.test", role: "viewer" })
      actorId = owner.id
      await webhooks.createWebhook({ url: "https://example.com/a", events: ["*"] })
      const [row] = await tdb.sql<{ id: string; active: boolean }[]>`
        SELECT id, active FROM webhooks WHERE user_id = ${owner.id}
      `
      expect(row.active).toBe(true)

      actorId = attacker.id
      await webhooks.setWebhookActive(row.id, false)

      const after = await tdb.sql<{ active: boolean }[]>`
        SELECT active FROM webhooks WHERE id = ${row.id}
      `
      expect(after[0].active).toBe(true) // unchanged
    })

    it("owner: toggles their own webhook's active flag", async () => {
      const owner = await seedUser({ email: "owner2@int.test", role: "viewer" })
      actorId = owner.id
      await webhooks.createWebhook({ url: "https://example.com/b", events: ["*"] })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE user_id = ${owner.id}
      `

      await webhooks.setWebhookActive(row.id, false)

      const after = await tdb.sql<{ active: boolean }[]>`
        SELECT active FROM webhooks WHERE id = ${row.id}
      `
      expect(after[0].active).toBe(false)
    })
  })

  describe("deleteWebhook", () => {
    it("a non-owner's delete call has ZERO effect — the row still exists", async () => {
      const owner = await seedUser({ email: "owner3@int.test", role: "viewer" })
      const attacker = await seedUser({ email: "attacker2@int.test", role: "viewer" })
      actorId = owner.id
      await webhooks.createWebhook({ url: "https://example.com/c", events: ["*"] })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE user_id = ${owner.id}
      `

      actorId = attacker.id
      await webhooks.deleteWebhook(row.id)

      const after = await tdb.sql<{ id: string }[]>`SELECT id FROM webhooks WHERE id = ${row.id}`
      expect(after).toHaveLength(1)
    })

    it("owner: deletes their own webhook + audit entry", async () => {
      const owner = await seedUser({ email: "owner4@int.test", role: "editor" })
      actorId = owner.id
      await webhooks.createWebhook({ url: "https://example.com/d", events: ["*"] })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE user_id = ${owner.id}
      `

      await webhooks.deleteWebhook(row.id)

      const after = await tdb.sql<{ id: string }[]>`SELECT id FROM webhooks WHERE id = ${row.id}`
      expect(after).toHaveLength(0)

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'webhook.deleted'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("exportWebhooks", () => {
    it("editor is blocked — returns a failure result", async () => {
      const editor = await seedUser({ email: "editor@int.test", role: "editor" })
      actorId = editor.id
      const result = await webhooks.exportWebhooks()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it("admin: returns CSV data, the signing secret is never included", async () => {
      const admin = await seedUser({ email: "admin@int.test", role: "admin" })
      actorId = admin.id
      const { secret } = await webhooks.createWebhook({
        url: "https://example.com/export",
        events: ["*"],
      })

      const result = await webhooks.exportWebhooks()
      expect(result).toMatchObject({ success: true, contentType: "text/csv" })
      if (result.success && secret) {
        expect(result.data).toContain("https://example.com/export")
        expect(result.data).not.toContain(secret)
      }
    })
  })

  describe("sendTestEvent", () => {
    it("a non-owner gets 'not found' — deliverToEndpoint is never called", async () => {
      const owner = await seedUser({ email: "owner5@int.test", role: "viewer" })
      const attacker = await seedUser({ email: "attacker3@int.test", role: "viewer" })
      actorId = owner.id
      await webhooks.createWebhook({ url: "https://example.com/e", events: ["*"] })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE user_id = ${owner.id}
      `

      actorId = attacker.id
      const result = await webhooks.sendTestEvent(row.id)
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(deliverToEndpoint).not.toHaveBeenCalled()
    })

    it("owner: delivers a ping and returns the status", async () => {
      const owner = await seedUser({ email: "owner6@int.test", role: "viewer" })
      actorId = owner.id
      await webhooks.createWebhook({ url: "https://example.com/f", events: ["*"] })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE user_id = ${owner.id}
      `

      const result = await webhooks.sendTestEvent(row.id)
      expect(result.status).toBe("success")
      expect(deliverToEndpoint).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // System-scoped (E330, admin-only)
  // -------------------------------------------------------------------------

  describe("createSystemWebhook", () => {
    it("editor is blocked — {error}, no system webhook written", async () => {
      const editor = await seedUser({ email: "sys-editor@int.test", role: "editor" })
      actorId = editor.id

      const result = await webhooks.createSystemWebhook({ url: "https://example.com/sys1" })
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(await countWebhooks(tdb, "system")).toBe(0)
    })

    it("admin: creates a system-scoped webhook + audit entry", async () => {
      const admin = await seedUser({ email: "sys-admin@int.test", role: "admin" })
      actorId = admin.id

      const result = await webhooks.createSystemWebhook({ url: "https://example.com/sys2" })
      expect(result.secret).toBeDefined()
      expect(await countWebhooks(tdb, "system")).toBe(1)

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'system_webhook.created'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("setSystemWebhookActive", () => {
    it("editor is blocked — {error}, active flag unchanged", async () => {
      const admin = await seedUser({ email: "sys-admin2@int.test", role: "admin" })
      actorId = admin.id
      await webhooks.createSystemWebhook({ url: "https://example.com/sys3" })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE scope = 'system'
      `

      const editor = await seedUser({ email: "sys-editor2@int.test", role: "editor" })
      actorId = editor.id
      const result = await webhooks.setSystemWebhookActive(row.id, false)
      expect(result).toMatchObject({ error: expect.any(String) })

      const after = await tdb.sql<{ active: boolean }[]>`
        SELECT active FROM webhooks WHERE id = ${row.id}
      `
      expect(after[0].active).toBe(true)
    })

    it("admin: toggles the system webhook's active flag + audit entry", async () => {
      const admin = await seedUser({ email: "sys-admin3@int.test", role: "admin" })
      actorId = admin.id
      await webhooks.createSystemWebhook({ url: "https://example.com/sys4" })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE scope = 'system'
      `

      const result = await webhooks.setSystemWebhookActive(row.id, false)
      expect(result.error).toBeUndefined()

      const after = await tdb.sql<{ active: boolean }[]>`
        SELECT active FROM webhooks WHERE id = ${row.id}
      `
      expect(after[0].active).toBe(false)

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'system_webhook.disabled'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("deleteSystemWebhook", () => {
    it("editor is blocked — {error}, the row still exists", async () => {
      const admin = await seedUser({ email: "sys-admin4@int.test", role: "admin" })
      actorId = admin.id
      await webhooks.createSystemWebhook({ url: "https://example.com/sys5" })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE scope = 'system'
      `

      const editor = await seedUser({ email: "sys-editor3@int.test", role: "editor" })
      actorId = editor.id
      const result = await webhooks.deleteSystemWebhook(row.id)
      expect(result).toMatchObject({ error: expect.any(String) })

      const after = await tdb.sql<{ id: string }[]>`SELECT id FROM webhooks WHERE id = ${row.id}`
      expect(after).toHaveLength(1)
    })

    it("admin: deletes the system webhook + audit entry", async () => {
      const admin = await seedUser({ email: "sys-admin5@int.test", role: "admin" })
      actorId = admin.id
      await webhooks.createSystemWebhook({ url: "https://example.com/sys6" })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE scope = 'system'
      `

      const result = await webhooks.deleteSystemWebhook(row.id)
      expect(result.error).toBeUndefined()

      const after = await tdb.sql<{ id: string }[]>`SELECT id FROM webhooks WHERE id = ${row.id}`
      expect(after).toHaveLength(0)

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'system_webhook.deleted'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("sendSystemTestEvent", () => {
    it("editor is blocked — {error}, deliverToEndpoint is never called", async () => {
      const admin = await seedUser({ email: "sys-admin6@int.test", role: "admin" })
      actorId = admin.id
      await webhooks.createSystemWebhook({ url: "https://example.com/sys7" })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE scope = 'system'
      `

      const editor = await seedUser({ email: "sys-editor4@int.test", role: "editor" })
      actorId = editor.id
      const result = await webhooks.sendSystemTestEvent(row.id)
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(deliverToEndpoint).not.toHaveBeenCalled()
    })

    it("admin: delivers a ping to the system endpoint and returns the status", async () => {
      const admin = await seedUser({ email: "sys-admin7@int.test", role: "admin" })
      actorId = admin.id
      await webhooks.createSystemWebhook({ url: "https://example.com/sys8" })
      const [row] = await tdb.sql<{ id: string }[]>`
        SELECT id FROM webhooks WHERE scope = 'system'
      `

      const result = await webhooks.sendSystemTestEvent(row.id)
      expect(result.status).toBe("success")
      expect(deliverToEndpoint).toHaveBeenCalledTimes(1)
    })
  })
})
