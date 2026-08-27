/**
 * admin.int.test.ts — actions/admin.ts wiring against a REAL throwaway Postgres
 * DB (E349). Covers the guard → validate → DB write → audit line for the four
 * admin-only mutations that had zero direct-call test coverage before this file:
 * setUserRole, deleteUser, resetUserTotp, exportAuditLog.
 *
 * Every mutation is gated by requireAdmin() (lib/permissions.ts), which
 * re-reads the live role from the DB (getLiveRole) rather than trusting the
 * session/JWT. redirect() is stubbed so the rejection path (a real Next.js
 * redirect throws a request-scope-only digest error) is observable as a plain
 * catchable throw — same convention as rbac.int.test.ts.
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
    "⏭ SKIP next-app/test/int/admin.int.test.ts — no reachable Postgres. " +
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

describe.skipIf(!reachable)("actions/admin.ts — requireAdmin wiring (int)", () => {
  let tdb: TestDb
  let admin: typeof import("@/actions/admin")

  beforeAll(async () => {
    tdb = await setupTestDb()
    admin = await import("@/actions/admin")
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    redirectMock.mockClear()
    await truncateDomain(["audit_log", "users"])
  })

  async function auditCount(action: string): Promise<number> {
    const rows = await tdb.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM audit_log WHERE action = ${action}
    `
    return rows[0].n
  }

  // -------------------------------------------------------------------------
  // setUserRole
  // -------------------------------------------------------------------------
  describe("setUserRole", () => {
    it("editor is blocked — redirected to /dashboard, target role unchanged, no audit", async () => {
      const editor = await seedUser({ email: "editor@int.test", role: "editor" })
      const target = await seedUser({ email: "target@int.test", role: "viewer" })
      actorId = editor.id

      await expect(admin.setUserRole(target.id, "admin")).rejects.toThrow(
        "NEXT_REDIRECT:/dashboard",
      )
      expect(redirectMock).toHaveBeenCalledWith("/dashboard")

      const rows = await tdb.sql<{ role: string }[]>`SELECT role FROM users WHERE id = ${target.id}`
      expect(rows[0].role).toBe("viewer")
      expect(await auditCount("user.role_changed")).toBe(0)
    })

    it("admin: changes the target's role and writes an audit entry", async () => {
      const adminUser = await seedUser({ email: "admin@int.test", role: "admin" })
      const target = await seedUser({ email: "target2@int.test", role: "viewer" })
      actorId = adminUser.id

      const result = await admin.setUserRole(target.id, "editor")
      expect(result).toEqual({ success: true })

      const rows = await tdb.sql<{ role: string }[]>`SELECT role FROM users WHERE id = ${target.id}`
      expect(rows[0].role).toBe("editor")

      const audits = await tdb.sql<{ actor_id: string; target_id: string; metadata: unknown }[]>`
        SELECT actor_id, target_id, metadata FROM audit_log WHERE action = 'user.role_changed'
      `
      expect(audits).toHaveLength(1)
      expect(audits[0].actor_id).toBe(adminUser.id)
      expect(audits[0].target_id).toBe(target.id)
      expect(audits[0].metadata).toMatchObject({ role: "editor" })
    })

    it("admin cannot change their own role (assertNotSelf) — no DB change, no audit", async () => {
      const adminUser = await seedUser({ email: "self-admin@int.test", role: "admin" })
      actorId = adminUser.id

      const result = await admin.setUserRole(adminUser.id, "viewer")
      expect(result).toMatchObject({ error: expect.any(String) })

      const rows = await tdb.sql<{ role: string }[]>`SELECT role FROM users WHERE id = ${adminUser.id}`
      expect(rows[0].role).toBe("admin")
      expect(await auditCount("user.role_changed")).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // deleteUser
  // -------------------------------------------------------------------------
  describe("deleteUser", () => {
    it("viewer is blocked — redirected to /dashboard, target row still exists, no audit", async () => {
      const viewer = await seedUser({ email: "viewer@int.test", role: "viewer" })
      const target = await seedUser({ email: "target3@int.test", role: "viewer" })
      actorId = viewer.id

      await expect(admin.deleteUser(target.id)).rejects.toThrow("NEXT_REDIRECT:/dashboard")

      const rows = await tdb.sql<{ id: string }[]>`SELECT id FROM users WHERE id = ${target.id}`
      expect(rows).toHaveLength(1)
      expect(await auditCount("user.deleted")).toBe(0)
    })

    it("admin: deletes the target user and writes an audit entry", async () => {
      const adminUser = await seedUser({ email: "admin2@int.test", role: "admin" })
      const target = await seedUser({ email: "target4@int.test", role: "editor" })
      actorId = adminUser.id

      const result = await admin.deleteUser(target.id)
      expect(result).toEqual({ success: true })

      const rows = await tdb.sql<{ id: string }[]>`SELECT id FROM users WHERE id = ${target.id}`
      expect(rows).toHaveLength(0)

      const audits = await tdb.sql<{ actor_id: string; target_id: string }[]>`
        SELECT actor_id, target_id FROM audit_log WHERE action = 'user.deleted'
      `
      expect(audits).toHaveLength(1)
      expect(audits[0].actor_id).toBe(adminUser.id)
      expect(audits[0].target_id).toBe(target.id)
    })
  })

  // -------------------------------------------------------------------------
  // resetUserTotp
  // -------------------------------------------------------------------------
  describe("resetUserTotp", () => {
    async function seedTotpUser(email: string) {
      const user = await seedUser({ email, role: "viewer" })
      await tdb.sql`
        UPDATE users SET totp_secret = 'JBSWY3DPEHPK3PXP', totp_enabled = true,
          backup_codes = ${tdb.sql.array(["a", "b"])}
        WHERE id = ${user.id}
      `
      return user
    }

    it("editor is blocked — redirected to /dashboard, TOTP fields untouched, no audit", async () => {
      const editor = await seedUser({ email: "editor2@int.test", role: "editor" })
      const target = await seedTotpUser("totp-target@int.test")
      actorId = editor.id

      await expect(admin.resetUserTotp(target.id)).rejects.toThrow("NEXT_REDIRECT:/dashboard")

      const rows = await tdb.sql<{ totp_enabled: boolean }[]>`
        SELECT totp_enabled FROM users WHERE id = ${target.id}
      `
      expect(rows[0].totp_enabled).toBe(true)
      expect(await auditCount("user.totp_reset")).toBe(0)
    })

    it("admin: clears TOTP secret/enabled/backup-codes and writes an audit entry", async () => {
      const adminUser = await seedUser({ email: "admin3@int.test", role: "admin" })
      const target = await seedTotpUser("totp-target2@int.test")
      actorId = adminUser.id

      const result = await admin.resetUserTotp(target.id)
      expect(result).toEqual({ success: true })

      const rows = await tdb.sql<{
        totp_secret: string | null
        totp_enabled: boolean
        backup_codes: unknown
      }[]>`SELECT totp_secret, totp_enabled, backup_codes FROM users WHERE id = ${target.id}`
      expect(rows[0].totp_secret).toBeNull()
      expect(rows[0].totp_enabled).toBe(false)
      expect(rows[0].backup_codes).toBeNull()

      expect(await auditCount("user.totp_reset")).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // exportAuditLog
  // -------------------------------------------------------------------------
  describe("exportAuditLog", () => {
    it("viewer is blocked — returns a failure result, not a thrown redirect", async () => {
      const viewer = await seedUser({ email: "viewer2@int.test", role: "viewer" })
      actorId = viewer.id

      const result = await admin.exportAuditLog()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it("admin: returns CSV data including a prior audit entry", async () => {
      const adminUser = await seedUser({ email: "admin4@int.test", role: "admin" })
      const target = await seedUser({ email: "target5@int.test", role: "viewer" })
      actorId = adminUser.id

      await admin.setUserRole(target.id, "editor") // produces one real audit row

      const result = await admin.exportAuditLog()
      expect(result).toMatchObject({ success: true, contentType: "text/csv" })
      if (result.success) {
        expect(result.data).toContain("user.role_changed")
      }
    })
  })

  // -------------------------------------------------------------------------
  // E356 — the `on_behalf` flag (AC #5)
  //
  // The value that matters is the one PERSISTED, so these read the column back
  // out of Postgres rather than trusting the argument passed to logAudit().
  // resetUserTotp is the decisive case: it is the only admin action with no
  // self-target guard, so the same action produces true for another user and
  // false for the admin's own account.
  // -------------------------------------------------------------------------
  describe("on_behalf flag (E356)", () => {
    async function readOnBehalf(action: string): Promise<boolean[]> {
      const rows = await tdb.sql<{ on_behalf: boolean }[]>`
        SELECT on_behalf FROM audit_log WHERE action = ${action} ORDER BY created_at
      `
      return rows.map((r) => r.on_behalf)
    }

    it("setUserRole on another user ⇒ on_behalf = true", async () => {
      const adminUser = await seedUser({ email: "ob-admin@int.test", role: "admin" })
      const target = await seedUser({ email: "ob-target@int.test", role: "viewer" })
      actorId = adminUser.id

      expect(await admin.setUserRole(target.id, "editor")).toEqual({ success: true })
      expect(await readOnBehalf("user.role_changed")).toEqual([true])
    })

    it("deleteUser on another user ⇒ on_behalf = true", async () => {
      const adminUser = await seedUser({ email: "ob-admin2@int.test", role: "admin" })
      const target = await seedUser({ email: "ob-target2@int.test", role: "viewer" })
      actorId = adminUser.id

      expect(await admin.deleteUser(target.id)).toEqual({ success: true })
      expect(await readOnBehalf("user.deleted")).toEqual([true])
    })

    it("resetUserTotp on ANOTHER user ⇒ true; on the admin's OWN account ⇒ false", async () => {
      const adminUser = await seedUser({ email: "ob-admin3@int.test", role: "admin" })
      const target = await seedUser({ email: "ob-target3@int.test", role: "viewer" })
      actorId = adminUser.id

      // acting FOR someone else
      expect(await admin.resetUserTotp(target.id)).toEqual({ success: true })
      // acting on themselves — same action, same admin, different flag
      expect(await admin.resetUserTotp(adminUser.id)).toEqual({ success: true })

      expect(await readOnBehalf("user.totp_reset")).toEqual([true, false])
    })

    it("a pre-existing-shape audit write (no onBehalf argument) defaults to false", async () => {
      const adminUser = await seedUser({ email: "ob-admin4@int.test", role: "admin" })
      const { logAudit } = await import("@/lib/audit")

      // Exactly the call shape every pre-E356 call site still uses, unchanged.
      await logAudit({ actorId: adminUser.id, action: "legacy.shape", targetType: "user" })

      expect(await readOnBehalf("legacy.shape")).toEqual([false])
    })
  })
})
