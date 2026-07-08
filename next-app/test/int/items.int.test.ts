/**
 * items.int.test.ts — createItem / deleteItem (actions/items.ts) against a real
 * throwaway Postgres DB.
 *
 * The actions go through the full pipeline: requireEditor() → getLiveRole(DB) →
 * db.insert/delete → revalidatePath. We mock only `@/lib/auth`'s auth() (returns
 * the seeded actor's id) and `next/cache`'s revalidatePath (a no-op outside a
 * request scope). `getLiveRole` is NOT mocked — it reads the seeded role straight
 * from the throwaway DB, so the real RBAC path is exercised end-to-end.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  countItems,
  isPostgresReachable,
  readItemsByUser,
  seedUser,
  setupTestDb,
  teardownTestDb,
  truncateDomain,
} from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn(
    "⏭ SKIP next-app/test/int/items.int.test.ts — no reachable Postgres. " +
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
// Every actor in this file is an editor/admin, so requireEditor() never
// redirects — stub next/navigation defensively so the module loads cleanly
// under plain vitest (no Next.js request context). See rbac.int.test.ts for
// the redirect-path assertions.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

describe.skipIf(!reachable)("createItem / deleteItem (actions/items.ts)", () => {
  // Loaded AFTER setupTestDb() sets DATABASE_URL (so the db singleton binds to
  // the throwaway DB) — never a top-level static import in an int test file.
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
    await truncateDomain(["items", "users"])
  })

  it("editor: create → the row exists in the DB, then delete removes it", async () => {
    const editor = await seedUser({ email: "editor@int.test", role: "editor" })
    actorId = editor.id

    const createForm = new FormData()
    createForm.set("title", "Integration Widget")
    const createResult = await items.createItem(null, createForm)
    expect(createResult).toBeNull() // success — no error

    const rows = await readItemsByUser(editor.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe("Integration Widget")

    const deleteResult = await items.deleteItem(rows[0].id)
    expect(deleteResult).toBeNull() // success — no error

    expect(await readItemsByUser(editor.id)).toHaveLength(0)
    expect(await countItems()).toBe(0)
  })

  it("editor: deleteItem on another user's item is rejected (ownership-scoped WHERE)", async () => {
    const owner = await seedUser({ email: "owner@int.test", role: "editor" })
    const intruder = await seedUser({ email: "intruder@int.test", role: "editor" })

    actorId = owner.id
    const createForm = new FormData()
    createForm.set("title", "Owner's Widget")
    await items.createItem(null, createForm)
    const [ownerItem] = await readItemsByUser(owner.id)

    actorId = intruder.id
    const result = await items.deleteItem(ownerItem.id)
    expect(result).toMatchObject({ error: expect.any(String) })

    // untouched — still owned by the original creator
    expect(await readItemsByUser(owner.id)).toHaveLength(1)
  })

  it("validation: blank title is rejected before any DB write", async () => {
    const editor = await seedUser({ email: "blank@int.test", role: "editor" })
    actorId = editor.id

    const form = new FormData()
    form.set("title", "")
    const result = await items.createItem(null, form)
    expect(result).toMatchObject({ error: expect.any(String) })
    expect(await countItems()).toBe(0)
  })
})
