/**
 * user.int.test.ts — changePassword (actions/user.ts) against a real throwaway
 * Postgres DB.
 *
 * Locks the E324 behavior change: `changePassword` now wires the previously-orphan
 * `assertPasswordChanged` guard, so a no-op change (new password identical to the
 * current one) is REJECTED and the stored hash is left untouched — instead of
 * silently "succeeding". We also assert the happy path (a genuinely different
 * password persists a new hash) so the guard can't regress into blocking real
 * changes.
 *
 * Only `@/lib/auth` (auth()) + `next/cache` are mocked; `db`, bcrypt hashing and
 * the rate-limit guard are the real pipeline. Follows the harness dynamic-import
 * ordering trap (setupTestDb before importing the action).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  isPostgresReachable,
  readUserPasswordHash,
  seedUser,
  setupTestDb,
  teardownTestDb,
  truncateDomain,
} from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn(
    "⏭ SKIP next-app/test/int/user.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

// Mutable actor id flipped per-test; the mock reads it lazily.
let actorId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (actorId ? { user: { id: actorId } } : null),
}))

// next/cache revalidatePath is a no-op outside a request scope; stub it.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
// requireAuth() only redirects when unauthenticated; we always supply a session,
// but stub next/navigation defensively so the module loads cleanly.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

function formOf(current: string, next: string): FormData {
  const form = new FormData()
  form.set("currentPassword", current)
  form.set("newPassword", next)
  form.set("confirmPassword", next)
  return form
}

describe.skipIf(!reachable)("changePassword (actions/user.ts) — no-op guard (E324)", () => {
  let user: typeof import("@/actions/user")
  let hashPassword: (pw: string) => Promise<string>

  const CURRENT = "CurrentPass1!"

  beforeAll(async () => {
    await setupTestDb() // sets DATABASE_URL first
    user = await import("@/actions/user") // dynamic import AFTER — never top-level
    ;({ hashPassword } = await import("@/lib/password"))
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    await truncateDomain(["users"])
  })

  it("rejects a same-password change and leaves the stored hash untouched", async () => {
    const hash = await hashPassword(CURRENT)
    const actor = await seedUser({ email: "pw-noop@int.test", role: "viewer", passwordHash: hash })
    actorId = actor.id

    const result = await user.changePassword(null, formOf(CURRENT, CURRENT))
    expect(result?.error).toMatch(/相同/) // "新密碼不能與目前密碼相同。"

    // The hash must be exactly what we seeded — nothing was written.
    expect(await readUserPasswordHash(actor.id)).toBe(hash)
  })

  it("allows a genuinely different password and persists a new hash", async () => {
    const hash = await hashPassword(CURRENT)
    const actor = await seedUser({ email: "pw-ok@int.test", role: "viewer", passwordHash: hash })
    actorId = actor.id

    const result = await user.changePassword(null, formOf(CURRENT, "DifferentPass2@"))
    expect(result?.success).toBe(true)

    const after = await readUserPasswordHash(actor.id)
    expect(after).not.toBeNull()
    expect(after).not.toBe(hash) // a new bcrypt hash was written
  })
})
