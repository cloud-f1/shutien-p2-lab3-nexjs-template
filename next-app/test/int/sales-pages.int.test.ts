/**
 * sales-pages.int.test.ts — actions/sales-pages.ts wiring against a REAL
 * throwaway Postgres DB (E349). The 5 mutations are built on the defineAction()
 * factory (E323) with `allow: isAdmin` — a denied caller gets `{ error }` back
 * (no throw/redirect), and a successful mutation gets its audit entry written
 * by the factory itself (E323's "audit can't be forgotten" guarantee).
 *
 * `listSalesPages` (line ~271) is a KNOWN, already-filed gap (E350) — it has NO
 * guard at all. Per the E349 epic instructions this file does NOT fix it; the
 * one test below only documents the current (unguarded) behavior and is
 * labeled accordingly — it is not an assertion that this is correct.
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
    "⏭ SKIP next-app/test/int/sales-pages.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

let actorId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (actorId ? { user: { id: actorId } } : null),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

/** A minimal, schema-valid payload for createSalesPageSchema/updateSalesPageSchema. */
function validInput(slug: string, status: "draft" | "published" = "draft") {
  return {
    slug,
    productId: null,
    renderMode: "structured" as const,
    status,
    content: {
      slug,
      meta: { title: "T", description: "D" },
      style: { preset: "clean" as const },
      hero: { headline: "H", subheadline: "S", cta: { label: "Buy", href: "/x" } },
      painPoints: { heading: "P", items: ["a"] },
      solution: { heading: "S2", description: "D2" },
      modules: { heading: "M", items: [{ title: "t", content: "c", outcome: "o" }] },
      testimonials: { heading: "Te", items: [{ quote: "q", name: "n", role: "r" }] },
      pricing: {
        heading: "Pr",
        price: 100,
        currency: "TWD",
        deadline: "2030-01-01T00:00:00.000Z",
        cta: { label: "Buy", href: "/x" },
      },
      riskReversal: { heading: "R", guaranteeDays: 7, description: "D3" },
      faq: { heading: "F", items: [{ question: "q", answer: "a" }] },
    },
  }
}

async function countSalesPages(tdb: TestDb): Promise<number> {
  const rows = await tdb.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM sales_pages`
  return rows[0].n
}

describe.skipIf(!reachable)("actions/sales-pages.ts wiring (int)", () => {
  let tdb: TestDb
  let salesPages: typeof import("@/actions/sales-pages")

  beforeAll(async () => {
    tdb = await setupTestDb()
    salesPages = await import("@/actions/sales-pages")
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    await truncateDomain(["audit_log", "sales_pages", "users"])
  })

  describe("createSalesPage", () => {
    it("editor is blocked — {error}, zero rows written, zero audit", async () => {
      const editor = await seedUser({ email: "editor@int.test", role: "editor" })
      actorId = editor.id

      const result = await salesPages.createSalesPage(validInput("editor-attempt"))
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(await countSalesPages(tdb)).toBe(0)
    })

    it("admin: creates the row and writes an audit entry", async () => {
      const admin = await seedUser({ email: "admin@int.test", role: "admin" })
      actorId = admin.id

      const result = await salesPages.createSalesPage(validInput("admin-page"))
      expect(result.error).toBeUndefined()
      expect(result.slug).toBe("admin-page")

      expect(await countSalesPages(tdb)).toBe(1)
      const audits = await tdb.sql<{ actor_id: string; target_id: string }[]>`
        SELECT actor_id, target_id FROM audit_log WHERE action = 'sales_page.created'
      `
      expect(audits).toHaveLength(1)
      expect(audits[0].actor_id).toBe(admin.id)
      expect(audits[0].target_id).toBe(result.id)
    })
  })

  describe("updateSalesPage", () => {
    it("viewer is blocked — {error}, the row is untouched", async () => {
      const admin = await seedUser({ email: "admin2@int.test", role: "admin" })
      actorId = admin.id
      const created = await salesPages.createSalesPage(validInput("to-update"))

      const viewer = await seedUser({ email: "viewer@int.test", role: "viewer" })
      actorId = viewer.id
      const result = await salesPages.updateSalesPage({
        ...validInput("to-update", "published"),
        id: created.id!,
      })
      expect(result).toMatchObject({ error: expect.any(String) })

      const rows = await tdb.sql<{ status: string }[]>`
        SELECT status FROM sales_pages WHERE id = ${created.id!}
      `
      expect(rows[0].status).toBe("draft")
    })

    it("admin: updates the row and writes an audit entry", async () => {
      const admin = await seedUser({ email: "admin3@int.test", role: "admin" })
      actorId = admin.id
      const created = await salesPages.createSalesPage(validInput("to-update2"))

      const result = await salesPages.updateSalesPage({
        ...validInput("to-update2", "published"),
        id: created.id!,
      })
      expect(result.error).toBeUndefined()

      const rows = await tdb.sql<{ status: string }[]>`
        SELECT status FROM sales_pages WHERE id = ${created.id!}
      `
      expect(rows[0].status).toBe("published")

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'sales_page.updated'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("setSalesPageStatus", () => {
    it("editor is blocked — {error}, status unchanged", async () => {
      const admin = await seedUser({ email: "admin4@int.test", role: "admin" })
      actorId = admin.id
      const created = await salesPages.createSalesPage(validInput("to-publish"))

      const editor = await seedUser({ email: "editor2@int.test", role: "editor" })
      actorId = editor.id
      const result = await salesPages.setSalesPageStatus(created.id!, "published")
      expect(result).toMatchObject({ error: expect.any(String) })

      const rows = await tdb.sql<{ status: string }[]>`
        SELECT status FROM sales_pages WHERE id = ${created.id!}
      `
      expect(rows[0].status).toBe("draft")
    })

    it("admin: flips status to published, stamps publishedAt, writes an audit entry", async () => {
      const admin = await seedUser({ email: "admin5@int.test", role: "admin" })
      actorId = admin.id
      const created = await salesPages.createSalesPage(validInput("to-publish2"))

      const result = await salesPages.setSalesPageStatus(created.id!, "published")
      expect(result.error).toBeUndefined()

      const rows = await tdb.sql<{ status: string; published_at: Date | null }[]>`
        SELECT status, published_at FROM sales_pages WHERE id = ${created.id!}
      `
      expect(rows[0].status).toBe("published")
      expect(rows[0].published_at).not.toBeNull()

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'sales_page.published'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("deleteSalesPage", () => {
    it("viewer is blocked — {error}, the row still exists", async () => {
      const admin = await seedUser({ email: "admin6@int.test", role: "admin" })
      actorId = admin.id
      const created = await salesPages.createSalesPage(validInput("to-delete"))

      const viewer = await seedUser({ email: "viewer2@int.test", role: "viewer" })
      actorId = viewer.id
      const result = await salesPages.deleteSalesPage(created.id!)
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(await countSalesPages(tdb)).toBe(1)
    })

    it("admin: deletes the row and writes an audit entry", async () => {
      const admin = await seedUser({ email: "admin7@int.test", role: "admin" })
      actorId = admin.id
      const created = await salesPages.createSalesPage(validInput("to-delete2"))

      const result = await salesPages.deleteSalesPage(created.id!)
      expect(result).toBeNull() // success

      expect(await countSalesPages(tdb)).toBe(0)
      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'sales_page.deleted'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  describe("createSalesPagePreviewLink", () => {
    it("editor is blocked — {error}, no preview-link audit entry written", async () => {
      const admin = await seedUser({ email: "admin8@int.test", role: "admin" })
      actorId = admin.id
      const created = await salesPages.createSalesPage(validInput("to-preview"))

      const editor = await seedUser({ email: "editor3@int.test", role: "editor" })
      actorId = editor.id
      const result = await salesPages.createSalesPagePreviewLink(created.id!)
      expect(result).toMatchObject({ error: expect.any(String) })

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'sales_page.preview_link'
      `
      expect(audits[0].n).toBe(0)
    })

    it("admin: returns a signed preview URL for the page's slug + writes an audit entry", async () => {
      const admin = await seedUser({ email: "admin9@int.test", role: "admin" })
      actorId = admin.id
      const created = await salesPages.createSalesPage(validInput("to-preview2"))

      const result = await salesPages.createSalesPagePreviewLink(created.id!)
      expect(result.error).toBeUndefined()
      expect(result.url).toContain("/p/to-preview2?preview=")

      const audits = await tdb.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_log WHERE action = 'sales_page.preview_link'
      `
      expect(audits[0].n).toBe(1)
    })
  })

  // ---------------------------------------------------------------------
  // KNOWN GAP (E350) — documenting current behavior, NOT asserting it is
  // correct. `listSalesPages` has no guard at all: any caller, including an
  // unauthenticated one, can call it directly and get every sales page back
  // (including unpublished drafts). Do NOT treat this test as a spec to
  // preserve — it exists only so a future fix of E350 has a test that goes
  // red, signalling the gap was closed.
  // ---------------------------------------------------------------------
  it("KNOWN GAP (E350): listSalesPages has no auth guard — an unauthenticated caller can list all pages", async () => {
    const admin = await seedUser({ email: "admin10@int.test", role: "admin" })
    actorId = admin.id
    await salesPages.createSalesPage(validInput("unguarded-listing", "draft"))

    actorId = null // no session at all
    const rows = await salesPages.listSalesPages()
    expect(rows.some((r) => r.slug === "unguarded-listing")).toBe(true)
  })
})
