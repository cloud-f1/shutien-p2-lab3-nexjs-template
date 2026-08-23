/**
 * team.int.test.ts — actions/team.ts wiring against a REAL throwaway Postgres
 * DB (E349). inviteMember/revokeInvitation/exportTeam are requireAdmin-gated;
 * acceptInvitation is login-only (requireAuth) but authorization boundary is
 * ownership of the invited EMAIL, not role — a signed-in user whose email
 * doesn't match the invite must be refused, with zero DB effect.
 *
 * `@/lib/email` is mocked so no real SMTP transport is touched (mirrors
 * entitlements.int.test.ts / admin-revenue.int.test.ts's convention).
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
    "⏭ SKIP next-app/test/int/team.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

let actorId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (actorId ? { user: { id: actorId } } : null),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const sendInviteEmail = vi.fn(async (..._a: unknown[]) => {})
vi.mock("@/lib/email", () => ({
  sendInviteEmail: (...a: unknown[]) => sendInviteEmail(...a),
}))

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
})
vi.mock("next/navigation", () => ({ redirect: redirectMock }))

async function countInvitations(tdb: TestDb): Promise<number> {
  const rows = await tdb.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invitations`
  return rows[0].n
}

describe.skipIf(!reachable)("actions/team.ts wiring (int)", () => {
  let tdb: TestDb
  let team: typeof import("@/actions/team")

  beforeAll(async () => {
    tdb = await setupTestDb()
    team = await import("@/actions/team")
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    redirectMock.mockClear()
    vi.clearAllMocks()
    await truncateDomain(["audit_log", "invitations", "users"])
  })

  describe("inviteMember", () => {
    it("editor is blocked — redirected to /dashboard, no invitation row, no audit", async () => {
      const editor = await seedUser({ email: "editor@int.test", role: "editor" })
      actorId = editor.id

      await expect(
        team.inviteMember({ email: "new@int.test", role: "viewer" }),
      ).rejects.toThrow("NEXT_REDIRECT:/dashboard")

      expect(await countInvitations(tdb)).toBe(0)
    })

    it("admin: creates a pending invitation + audit entry", async () => {
      const admin = await seedUser({ email: "admin@int.test", role: "admin" })
      actorId = admin.id

      const result = await team.inviteMember({ email: "invitee@int.test", role: "editor" })
      expect(result.token).toBeDefined()

      const rows = await tdb.sql<{ status: string; role: string }[]>`
        SELECT status, role FROM invitations WHERE email = 'invitee@int.test'
      `
      expect(rows).toHaveLength(1)
      expect(rows[0].status).toBe("pending")
      expect(rows[0].role).toBe("editor")

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'invitation.created'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("revokeInvitation", () => {
    async function seedPendingInvite(email: string, invitedBy: string): Promise<string> {
      const rows = await tdb.sql<{ id: string }[]>`
        INSERT INTO invitations (email, role, token, invited_by, expires_at)
        VALUES (${email}, 'viewer', ${`tok-${email}`}, ${invitedBy}, now() + interval '7 days')
        RETURNING id
      `
      return rows[0].id
    }

    it("viewer is blocked — redirected to /dashboard, invitation still pending", async () => {
      const admin = await seedUser({ email: "admin2@int.test", role: "admin" })
      const id = await seedPendingInvite("pending1@int.test", admin.id)

      const viewer = await seedUser({ email: "viewer@int.test", role: "viewer" })
      actorId = viewer.id
      await expect(team.revokeInvitation(id)).rejects.toThrow("NEXT_REDIRECT:/dashboard")

      const rows = await tdb.sql<{ status: string }[]>`
        SELECT status FROM invitations WHERE id = ${id}
      `
      expect(rows[0].status).toBe("pending")
    })

    it("admin: revokes the invitation + audit entry", async () => {
      const admin = await seedUser({ email: "admin3@int.test", role: "admin" })
      actorId = admin.id
      const id = await seedPendingInvite("pending2@int.test", admin.id)

      await team.revokeInvitation(id)

      const rows = await tdb.sql<{ status: string }[]>`
        SELECT status FROM invitations WHERE id = ${id}
      `
      expect(rows[0].status).toBe("revoked")

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'invitation.revoked'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("acceptInvitation", () => {
    async function seedPendingInvite(email: string, invitedBy: string): Promise<string> {
      const rows = await tdb.sql<{ token: string }[]>`
        INSERT INTO invitations (email, role, token, invited_by, expires_at)
        VALUES (${email}, 'editor', ${`tok-accept-${email}`}, ${invitedBy}, now() + interval '7 days')
        RETURNING token
      `
      return rows[0].token
    }

    it("unauthenticated caller is blocked — redirected to /login, invite still pending", async () => {
      const admin = await seedUser({ email: "admin4@int.test", role: "admin" })
      const token = await seedPendingInvite("target@int.test", admin.id)
      actorId = null

      await expect(team.acceptInvitation(token)).rejects.toThrow("NEXT_REDIRECT:/login")

      const invite = await tdb.sql<{ status: string }[]>`
        SELECT status FROM invitations WHERE token = ${token}
      `
      expect(invite[0].status).toBe("pending")
    })

    it("a signed-in user whose email does NOT match the invite is refused — role unchanged, invite still pending", async () => {
      const admin = await seedUser({ email: "admin5@int.test", role: "admin" })
      const token = await seedPendingInvite("invited@int.test", admin.id)
      const impostor = await seedUser({ email: "impostor@int.test", role: "viewer" })
      actorId = impostor.id

      const result = await team.acceptInvitation(token)
      expect(result).toMatchObject({ error: expect.any(String) })

      const rows = await tdb.sql<{ role: string }[]>`
        SELECT role FROM users WHERE id = ${impostor.id}
      `
      expect(rows[0].role).toBe("viewer") // unchanged — the escalation attempt failed

      const invite = await tdb.sql<{ status: string }[]>`
        SELECT status FROM invitations WHERE token = ${token}
      `
      expect(invite[0].status).toBe("pending")
    })

    it("the invited user (matching email) accepts — role applied, invite accepted, audit entry", async () => {
      const admin = await seedUser({ email: "admin6@int.test", role: "admin" })
      const invitedEmail = "matching@int.test"
      const token = await seedPendingInvite(invitedEmail, admin.id)
      const invitedUser = await seedUser({ email: invitedEmail, role: "viewer" })
      actorId = invitedUser.id

      const result = await team.acceptInvitation(token)
      expect(result).toEqual({ ok: true })

      const rows = await tdb.sql<{ role: string; status: string }[]>`
        SELECT role, status FROM users WHERE id = ${invitedUser.id}
      `
      expect(rows[0].role).toBe("editor")
      expect(rows[0].status).toBe("active")

      const invite = await tdb.sql<{ status: string }[]>`
        SELECT status FROM invitations WHERE token = ${token}
      `
      expect(invite[0].status).toBe("accepted")

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'invitation.accepted'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("exportTeam", () => {
    it("editor is blocked — returns a failure result", async () => {
      const editor = await seedUser({ email: "editor2@int.test", role: "editor" })
      actorId = editor.id

      const result = await team.exportTeam()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it("admin: returns CSV data including members and invitations", async () => {
      const admin = await seedUser({ email: "admin7@int.test", role: "admin" })
      actorId = admin.id
      await team.inviteMember({ email: "csv-invitee@int.test", role: "viewer" })

      const result = await team.exportTeam()
      expect(result).toMatchObject({ success: true, contentType: "text/csv" })
      if (result.success) {
        expect(result.data).toContain("csv-invitee@int.test")
        expect(result.data).toContain("# Members")
        expect(result.data).toContain("# Invitations")
      }
    })
  })
})
