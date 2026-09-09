/**
 * sales-visibility.int.test.ts — E367.
 *
 * The bug this pins: `/p/[slug]` checked the E333 custom registry BEFORE any DB
 * read and rendered unconditionally, so `sales_pages.status` was never consulted
 * on that path. An admin could hit 取消發佈 — action returns success, writes a
 * `sales_page.unpublished` audit row, revalidates the path — and the page kept
 * serving to anonymous visitors. Meanwhile `canServeSalesPageRow` returned false
 * for `custom`, deferring to the registry: each side assumed the other owned it.
 *
 * These cases run `isCustomSalesPageVisible` against a REAL Postgres row, which
 * is the only place the "row exists and says draft" path can actually be proven.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { isPostgresReachable, setupTestDb, teardownTestDb, truncateDomain } from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn(
    "⏭ SKIP next-app/test/int/sales-visibility.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL.",
  )
}

const SLUG = "ai-launch-intensive" // the one slug actually in the custom registry

describe.skipIf(!reachable)("isCustomSalesPageVisible (E367)", () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>
  let isCustomSalesPageVisible: typeof import("@/lib/sales/resolver").isCustomSalesPageVisible
  let createPreviewToken: typeof import("@/lib/sales/preview-token").createPreviewToken

  beforeAll(async () => {
    db = await setupTestDb()
    ;({ isCustomSalesPageVisible } = await import("@/lib/sales/resolver"))
    ;({ createPreviewToken } = await import("@/lib/sales/preview-token"))
  })
  afterAll(async () => teardownTestDb())
  afterEach(async () => truncateDomain(["sales_pages"]))

  /** Insert a sales_pages row for SLUG with the given status/renderMode. */
  async function seedRow(status: "draft" | "published", renderMode = "custom") {
    await db.sql`
      insert into sales_pages (slug, content, render_mode, status)
      values (${SLUG}, ${JSON.stringify({ slug: SLUG })}::jsonb, ${renderMode}, ${status})
    `
  }

  it("AC1 — a DRAFT custom row is NOT visible to an anonymous visitor", async () => {
    await seedRow("draft")
    expect(await isCustomSalesPageVisible(SLUG)).toBe(false)
  })

  it("AC2 — a PUBLISHED custom row is visible", async () => {
    await seedRow("published")
    expect(await isCustomSalesPageVisible(SLUG)).toBe(true)
  })

  it("AC3 — a DRAFT custom row IS visible with a valid preview token", async () => {
    await seedRow("draft")
    const token = createPreviewToken(SLUG)
    expect(await isCustomSalesPageVisible(SLUG, { previewToken: token })).toBe(true)
  })

  it("AC3b — a draft row rejects a token minted for a DIFFERENT slug", async () => {
    await seedRow("draft")
    const token = createPreviewToken("some-other-slug")
    expect(await isCustomSalesPageVisible(SLUG, { previewToken: token })).toBe(false)
  })

  it("AC5 — a registered slug with NO row stays visible (pure code page)", async () => {
    // No seedRow() — the registry claims the slug, the DB knows nothing about it.
    expect(await isCustomSalesPageVisible(SLUG)).toBe(true)
  })

  it("the unpublish round-trip actually takes the page offline", async () => {
    await seedRow("published")
    expect(await isCustomSalesPageVisible(SLUG)).toBe(true)
    await db.sql`update sales_pages set status = 'draft' where slug = ${SLUG}`
    expect(await isCustomSalesPageVisible(SLUG)).toBe(false)
  })
})

/**
 * Route-level wiring (E367). The gate function above can be correct while the
 * ROUTE still fails to call it — which is exactly the shape of the original bug.
 * These call the real RSC and assert it raises Next's NEXT_NOT_FOUND, proving
 * the custom branch consults the gate before rendering.
 */
describe.skipIf(!reachable)("/p/[slug] route gate (E367)", () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>
  let SalesPage: (p: {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ preview?: string }>
  }) => Promise<unknown>
  let generateMetadata: typeof SalesPage

  beforeAll(async () => {
    db = await setupTestDb()
    const mod = await import("@/app/p/[slug]/page")
    SalesPage = mod.default as typeof SalesPage
    generateMetadata = mod.generateMetadata as typeof generateMetadata
  })
  afterAll(async () => teardownTestDb())
  afterEach(async () => truncateDomain(["sales_pages"]))

  const args = (slug: string, preview?: string) => ({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(preview ? { preview } : {}),
  })

  it("renders a DRAFT custom page as 404 instead of serving it publicly", async () => {
    await db.sql`
      insert into sales_pages (slug, content, render_mode, status)
      values (${SLUG}, ${JSON.stringify({ slug: SLUG })}::jsonb, 'custom', 'draft')
    `
    await expect(SalesPage(args(SLUG))).rejects.toThrowError(/NEXT_HTTP_ERROR_FALLBACK;404/)
  })

  it("leaks no metadata for a DRAFT custom page", async () => {
    await db.sql`
      insert into sales_pages (slug, content, render_mode, status)
      values (${SLUG}, ${JSON.stringify({ slug: SLUG })}::jsonb, 'custom', 'draft')
    `
    await expect(generateMetadata(args(SLUG))).resolves.toEqual({})
  })

  it("still renders the pure-code custom page when no DB row exists", async () => {
    await expect(SalesPage(args(SLUG))).resolves.toBeTruthy()
  })
})
