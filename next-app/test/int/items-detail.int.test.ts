/**
 * items-detail.int.test.ts — the IDOR guard for the item record-detail page
 * (E339, `app/(dashboard)/dashboard/items/[id]/page.tsx`) against a real
 * throwaway Postgres DB.
 *
 * This calls the page's default export directly (the same "invoke the async
 * Server Component function" convention `items.int.test.ts` uses for Server
 * Actions) rather than rendering it — JSX inside the page body creates plain
 * React element objects without ever calling the child component functions
 * (only a renderer would do that), so this exercises the REAL
 * `requireAuth() → getLiveRole(DB) → ownership/admin check → notFound()`
 * pipeline with zero risk of a DOM/hooks dependency creeping into an
 * integration test.
 *
 * `notFound()` (real, unmocked) just throws a plain `Error` with
 * `digest === "NEXT_HTTP_ERROR_FALLBACK;404"` — no request-scope needed — so
 * unlike `redirect()` it needs no stub to be observable here.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
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
    "⏭ SKIP next-app/test/int/items-detail.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

// Mutable actor id flipped per-test; the mock reads it lazily.
let actorId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (actorId ? { user: { id: actorId } } : null),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

// Keep the REAL notFound() (that's exactly what this test verifies gets
// thrown) — only stub redirect(), which throws a request-scope-only digest
// error that has no meaning under plain vitest node.
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
})
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>()
  return { ...actual, redirect: redirectMock }
})

const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404"

async function expectNotFound(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST })
}

describe.skipIf(!reachable)("Item detail page IDOR guard (dashboard/items/[id]/page.tsx)", () => {
  // Loaded AFTER setupTestDb() sets DATABASE_URL — never a top-level static
  // import of the page (or an action) in an int test file.
  let ItemDetailPage: typeof import("@/app/(dashboard)/dashboard/items/[id]/page").default
  let generateMetadata: typeof import("@/app/(dashboard)/dashboard/items/[id]/page").generateMetadata
  let items: typeof import("@/actions/items")

  beforeAll(async () => {
    await setupTestDb()
    ;({ default: ItemDetailPage, generateMetadata } = await import(
      "@/app/(dashboard)/dashboard/items/[id]/page"
    ))
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

  it("owner: sees their own item (no 404)", async () => {
    const owner = await seedUser({ email: "owner-detail@int.test", role: "editor" })
    actorId = owner.id
    const form = new FormData()
    form.set("title", "Owner's Widget")
    await items.createItem(null, form)
    const [row] = await readItemsByUser(owner.id)

    const result = await ItemDetailPage({ params: Promise.resolve({ id: row.id }) })
    expect(result).toBeTruthy() // rendered — did not throw notFound()
  })

  it("IDOR: a different, non-admin user gets notFound() — NOT a redirect", async () => {
    const owner = await seedUser({ email: "owner-idor@int.test", role: "editor" })
    const intruder = await seedUser({ email: "intruder-idor@int.test", role: "editor" })

    actorId = owner.id
    const form = new FormData()
    form.set("title", "Private Widget")
    await items.createItem(null, form)
    const [row] = await readItemsByUser(owner.id)

    actorId = intruder.id
    await expectNotFound(ItemDetailPage({ params: Promise.resolve({ id: row.id }) }))
    // The IDOR guard must reject by throwing notFound(), never by calling
    // redirect() — a redirect would leak "this id exists, you're just not
    // allowed to see it" to the intruder.
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it("admin CAN open another user's item (read-only IDOR relaxation)", async () => {
    const owner = await seedUser({ email: "owner-admin-view@int.test", role: "editor" })
    const admin = await seedUser({ email: "admin-view@int.test", role: "admin" })

    actorId = owner.id
    const form = new FormData()
    form.set("title", "Admin-visible Widget")
    await items.createItem(null, form)
    const [row] = await readItemsByUser(owner.id)

    actorId = admin.id
    const result = await ItemDetailPage({ params: Promise.resolve({ id: row.id }) })
    expect(result).toBeTruthy() // rendered — admin bypasses the ownership check
  })

  it("generateMetadata: an intruder does NOT get the record's real title (leak check)", async () => {
    // generateMetadata() and the page component resolve INDEPENDENTLY in the
    // App Router — a notFound() thrown in the page body does not
    // retroactively cancel metadata already computed from the same request.
    // This proves generateMetadata() carries its OWN ownership check rather
    // than trusting the page body's guard to cover it.
    const owner = await seedUser({ email: "owner-meta@int.test", role: "editor" })
    const intruder = await seedUser({ email: "intruder-meta@int.test", role: "editor" })

    actorId = owner.id
    const form = new FormData()
    form.set("title", "Super Secret Title")
    await items.createItem(null, form)
    const [row] = await readItemsByUser(owner.id)

    actorId = intruder.id
    const metadata = await generateMetadata({ params: Promise.resolve({ id: row.id }) })
    expect(String(metadata.title ?? "")).not.toContain("Super Secret Title")
  })

  it("generateMetadata: the owner DOES get the real title", async () => {
    const owner = await seedUser({ email: "owner-meta-2@int.test", role: "editor" })
    actorId = owner.id
    const form = new FormData()
    form.set("title", "Owner Can See This Title")
    await items.createItem(null, form)
    const [row] = await readItemsByUser(owner.id)

    const metadata = await generateMetadata({ params: Promise.resolve({ id: row.id }) })
    expect(String(metadata.title ?? "")).toContain("Owner Can See This Title")
  })

  it("generateMetadata: admin ALSO gets the real title (matches the page body's admin bypass)", async () => {
    const owner = await seedUser({ email: "owner-meta-3@int.test", role: "editor" })
    const admin = await seedUser({ email: "admin-meta@int.test", role: "admin" })

    actorId = owner.id
    const form = new FormData()
    form.set("title", "Admin Visible Title")
    await items.createItem(null, form)
    const [row] = await readItemsByUser(owner.id)

    actorId = admin.id
    const metadata = await generateMetadata({ params: Promise.resolve({ id: row.id }) })
    expect(String(metadata.title ?? "")).toContain("Admin Visible Title")
  })

  it("missing id: notFound() regardless of who's asking", async () => {
    const someone = await seedUser({ email: "anyone@int.test", role: "editor" })
    actorId = someone.id

    await expectNotFound(
      ItemDetailPage({ params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) }),
    )
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
