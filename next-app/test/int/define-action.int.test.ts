/**
 * define-action.int.test.ts — the defineAction() factory end-to-end against a REAL
 * throwaway Postgres DB (E323, ties to the E321 int harness).
 *
 * Exercises the migrated `deleteItem` (actions/items.ts), which is now built on
 * defineAction. The full pipeline runs for real: auth() → getLiveRole(DB) →
 * allow(canEdit) → handler(db.delete) → logAudit(DB) → revalidate. We mock only
 * `@/lib/auth`'s auth() (returns the seeded actor) and `next/cache`'s
 * revalidatePath (a no-op outside a request scope); getLiveRole AND the audit write
 * hit the throwaway DB, so the factory's guard + audit guarantee are verified for real.
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
    "⏭ SKIP next-app/test/int/define-action.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

let actorId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (actorId ? { user: { id: actorId } } : null),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

describe.skipIf(!reachable)("defineAction factory — deleteItem (actions/items.ts)", () => {
  // Loaded AFTER setupTestDb() points DATABASE_URL at the throwaway DB.
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
    await truncateDomain(["items", "users", "audit_log"])
  })

  it("editor: delete removes the row AND writes an audit entry (factory guarantee)", async () => {
    const { sql } = (await setupTestDb())
    const editor = await seedUser({ email: "editor@int.test", role: "editor" })
    actorId = editor.id

    const form = new FormData()
    form.set("title", "Factory Widget")
    await items.createItem(null, form)
    const [row] = await readItemsByUser(editor.id)

    const result = await items.deleteItem(row.id)
    expect(result).toBeNull() // success — no error
    expect(await readItemsByUser(editor.id)).toHaveLength(0)

    // The factory guarantees the audit entry is written on success.
    const audits = await sql<{ action: string; target_id: string; actor_id: string }[]>`
      SELECT action, target_id, actor_id FROM audit_log WHERE action = 'item.deleted'
    `
    expect(audits).toHaveLength(1)
    expect(audits[0].target_id).toBe(row.id)
    expect(audits[0].actor_id).toBe(editor.id)
  })

  it("unauthenticated caller: factory returns an error, no delete, no audit", async () => {
    const { sql } = await setupTestDb()
    const editor = await seedUser({ email: "owner@int.test", role: "editor" })
    actorId = editor.id
    const form = new FormData()
    form.set("title", "Owned Widget")
    await items.createItem(null, form)
    const [row] = await readItemsByUser(editor.id)

    actorId = null // auth() resolves to no session
    const result = await items.deleteItem(row.id)
    expect(result).toMatchObject({ error: expect.any(String) })
    expect(await countItems()).toBe(1) // untouched

    // Scoped to 'item.deleted' (not a total-table count) — the createItem
    // seed step above writes its own 'item.created' audit entry (E339, so
    // the record-detail activity card has real data to filter), which is
    // expected and unrelated to what this test is verifying: the rejected
    // delete attempt itself must write NO audit entry.
    const audits = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM audit_log WHERE action = 'item.deleted'
    `
    expect(audits[0].n).toBe(0)
  })
})
