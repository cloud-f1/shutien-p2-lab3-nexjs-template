/**
 * notifications.int.test.ts — actions/notifications.ts wiring against a REAL
 * throwaway Postgres DB (E349). Both mutations (markRead, markAllRead) are
 * login-only (requireAuth) but owner-scoped by `WHERE user_id = session.user.id`
 * — there is no role gate, so the authorization boundary here is ownership,
 * not role. A non-owner's call must have ZERO effect on another user's rows.
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
    "⏭ SKIP next-app/test/int/notifications.int.test.ts — no reachable Postgres. " +
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

async function seedNotification(
  tdb: TestDb,
  userId: string,
  title = "hello",
): Promise<string> {
  const rows = await tdb.sql<{ id: string }[]>`
    INSERT INTO notifications (user_id, title, type)
    VALUES (${userId}, ${title}, 'info')
    RETURNING id
  `
  return rows[0].id
}

describe.skipIf(!reachable)("actions/notifications.ts wiring (int)", () => {
  let tdb: TestDb
  let notifications: typeof import("@/actions/notifications")

  beforeAll(async () => {
    tdb = await setupTestDb()
    notifications = await import("@/actions/notifications")
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    redirectMock.mockClear()
    await truncateDomain(["notifications", "users"])
  })

  describe("markRead", () => {
    it("unauthenticated caller is blocked — redirected to /login, notification stays unread", async () => {
      const owner = await seedUser({ email: "owner@int.test", role: "viewer" })
      const id = await seedNotification(tdb, owner.id)
      actorId = null

      await expect(notifications.markRead(id)).rejects.toThrow("NEXT_REDIRECT:/login")

      const rows = await tdb.sql<{ read_at: Date | null }[]>`
        SELECT read_at FROM notifications WHERE id = ${id}
      `
      expect(rows[0].read_at).toBeNull()
    })

    it("a non-owner's call has ZERO effect — another user's notification stays unread", async () => {
      const owner = await seedUser({ email: "owner2@int.test", role: "viewer" })
      const attacker = await seedUser({ email: "attacker@int.test", role: "viewer" })
      const id = await seedNotification(tdb, owner.id)

      actorId = attacker.id // IDOR attempt
      await notifications.markRead(id)

      const rows = await tdb.sql<{ read_at: Date | null }[]>`
        SELECT read_at FROM notifications WHERE id = ${id}
      `
      expect(rows[0].read_at).toBeNull()
    })

    it("owner: marks their own notification read", async () => {
      const owner = await seedUser({ email: "owner3@int.test", role: "viewer" })
      const id = await seedNotification(tdb, owner.id)
      actorId = owner.id

      await notifications.markRead(id)

      const rows = await tdb.sql<{ read_at: Date | null }[]>`
        SELECT read_at FROM notifications WHERE id = ${id}
      `
      expect(rows[0].read_at).not.toBeNull()
    })
  })

  describe("markAllRead", () => {
    it("unauthenticated caller is blocked — redirected to /login", async () => {
      const owner = await seedUser({ email: "owner4@int.test", role: "viewer" })
      await seedNotification(tdb, owner.id)
      actorId = null

      await expect(notifications.markAllRead()).rejects.toThrow("NEXT_REDIRECT:/login")

      const rows = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM notifications WHERE user_id = ${owner.id} AND read_at IS NOT NULL
      `
      expect(rows[0].n).toBe(0)
    })

    it("marks only the caller's own unread notifications — another user's stay untouched", async () => {
      const alice = await seedUser({ email: "alice@int.test", role: "viewer" })
      const bob = await seedUser({ email: "bob@int.test", role: "viewer" })
      await seedNotification(tdb, alice.id, "a1")
      await seedNotification(tdb, alice.id, "a2")
      const bobsNotification = await seedNotification(tdb, bob.id, "b1")

      actorId = alice.id
      await notifications.markAllRead()

      const aliceUnread = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM notifications WHERE user_id = ${alice.id} AND read_at IS NULL
      `
      expect(aliceUnread[0].n).toBe(0)

      const bobsRow = await tdb.sql<{ read_at: Date | null }[]>`
        SELECT read_at FROM notifications WHERE id = ${bobsNotification}
      `
      expect(bobsRow[0].read_at).toBeNull() // untouched — cross-user leak would fail this
    })
  })
})
