/**
 * E354 — createSalesPage/updateSalesPage unique-violation handling.
 *
 * These two handlers used to string-match the unique constraint's name inside
 * `err.message` to turn a slug conflict into a friendly `{ error }` instead of
 * a 500. That is
 * exactly what `lib/db-errors.ts`'s module doc says never to do (locale/wording/
 * constraint-name fragile). This test proves the code-based replacement:
 * a SQLSTATE 23505 (unique_violation) error still returns the friendly message,
 * while any other Postgres error code (e.g. 23503 FK violation) still propagates
 * as a genuine throw — no db, no real Postgres involved (db is mocked).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let liveRole: "admin" | "editor" | "viewer" | undefined = "admin"
vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { id: "admin-1" } }),
}))
vi.mock("@/lib/permissions", () => ({
  getLiveRole: async () => liveRole,
}))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("drizzle-orm", () => ({ eq: (...a: unknown[]) => ({ __eq: a }) }))
vi.mock("@/lib/schema/sales", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/schema/sales")>()
  return {
    ...actual,
    salesPagesTable: { id: "id", slug: "slug", status: "status", publishedAt: "published_at" },
  }
})

// db mock — insert/update reject with the given error; select resolves an
// "existing row" so updateSalesPage reaches its own try/catch.
let insertError: unknown = null
let updateError: unknown = null
const PAGE_ID = "11111111-1111-1111-1111-111111111111"
const existingRow = { id: PAGE_ID, status: "draft" as const, publishedAt: null }

/** A Postgres driver error as it actually arrives: an Error with a `.code`. */
function pgError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: async () => {
          if (insertError) throw insertError
          return [{ id: "page-1", slug: "my-slug" }]
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([existingRow]),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {
          if (updateError) throw updateError
          return { count: 1 }
        },
      }),
    }),
  },
}))

const { createSalesPage, updateSalesPage } = await import("./sales-pages")

function validContent(slug: string) {
  return {
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
  }
}

function validInput(slug: string) {
  return {
    slug,
    productId: null,
    renderMode: "structured" as const,
    status: "draft" as const,
    content: validContent(slug),
  }
}

beforeEach(() => {
  liveRole = "admin"
  insertError = null
  updateError = null
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("createSalesPage", () => {
  it("returns a friendly error on a unique-violation (SQLSTATE 23505)", async () => {
    insertError = pgError("23505", "duplicate key value violates unique constraint")
    const result = await createSalesPage(validInput("taken-slug"))
    expect(result).toEqual({ error: "此網址代稱已被使用，請換一個。" })
  })

  it("re-throws any other Postgres error code (e.g. 23503 FK violation)", async () => {
    insertError = pgError("23503", "foreign key violation")
    await expect(createSalesPage(validInput("some-slug"))).rejects.toBe(insertError)
  })
})

describe("updateSalesPage", () => {
  it("returns a friendly error on a unique-violation (SQLSTATE 23505)", async () => {
    updateError = pgError("23505", "duplicate key value violates unique constraint")
    const result = await updateSalesPage({ ...validInput("taken-slug"), id: PAGE_ID })
    expect(result).toEqual({ error: "此網址代稱已被使用，請換一個。" })
  })

  it("re-throws any other Postgres error code (e.g. 23503 FK violation)", async () => {
    updateError = pgError("23503", "foreign key violation")
    await expect(
      updateSalesPage({ ...validInput("some-slug"), id: PAGE_ID }),
    ).rejects.toBe(updateError)
  })
})
