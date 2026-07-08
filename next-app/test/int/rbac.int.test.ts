/**
 * rbac.int.test.ts — the RBAC-guard rejection reference test.
 *
 * `createItem` is gated behind `requireEditor()` (lib/permissions.ts), which
 * re-reads the caller's role from the DB (`getLiveRole`) rather than trusting the
 * session — a viewer or an unauthenticated caller must be redirected away with NO
 * row written. `getLiveRole` is NOT mocked: it hits the real throwaway DB, so this
 * exercises the actual `auth() → getLiveRole(DB) → can(role) → handler` pipeline,
 * not a stubbed approximation of it.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  countItems,
  isPostgresReachable,
  seedUser,
  setupTestDb,
  teardownTestDb,
  truncateDomain,
} from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn(
    "⏭ SKIP next-app/test/int/rbac.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

// Mutable actor id flipped per-test; the mock reads it lazily.
let actorId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (actorId ? { user: { id: actorId } } : null),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

// requireAuth()/requireEditor() call next/navigation's redirect() on rejection.
// Real Next.js `redirect()` throws a special NEXT_REDIRECT digest error that
// only makes sense inside a request scope — stub it here so the rejection path
// is observable as a plain, catchable throw.
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
})
vi.mock("next/navigation", () => ({ redirect: redirectMock }))

describe.skipIf(!reachable)("RBAC guard — requireEditor (actions/items.ts createItem)", () => {
  // Loaded AFTER setupTestDb() sets DATABASE_URL — never a top-level static
  // import of an action in an int test file (see harness.ts header comment).
  let items: typeof import("@/actions/items")

  beforeAll(async () => {
    await setupTestDb()
    items = await import("@/actions/items")
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    redirectMock.mockClear()
    await truncateDomain(["items", "users"])
  })

  it("viewer is blocked — redirected to /dashboard, no row written", async () => {
    const viewer = await seedUser({ email: "viewer@int.test", role: "viewer" })
    actorId = viewer.id

    const form = new FormData()
    form.set("title", "Should never be created")

    await expect(items.createItem(null, form)).rejects.toThrow("NEXT_REDIRECT:/dashboard")
    expect(redirectMock).toHaveBeenCalledWith("/dashboard")
    expect(await countItems()).toBe(0)
  })

  it("unauthenticated caller is blocked — redirected to /login, no row written", async () => {
    actorId = null // auth() resolves to no session

    const form = new FormData()
    form.set("title", "Should never be created")

    await expect(items.createItem(null, form)).rejects.toThrow("NEXT_REDIRECT:/login")
    expect(redirectMock).toHaveBeenCalledWith("/login")
    expect(await countItems()).toBe(0)
  })

  it("admin (not just editor) is let through — the guard is role-inclusive, not role-exact", async () => {
    const admin = await seedUser({ email: "admin@int.test", role: "admin" })
    actorId = admin.id

    const form = new FormData()
    form.set("title", "Admin Widget")
    const result = await items.createItem(null, form)
    expect(result).toBeNull() // success — no error
    expect(await countItems()).toBe(1)
  })
})
