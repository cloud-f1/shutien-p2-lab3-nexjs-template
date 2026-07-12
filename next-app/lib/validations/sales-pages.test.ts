/**
 * E332 — sales-page admin CRUD Zod contract tests.
 */
import { describe, expect, it } from "vitest"

import {
  createSalesPageSchema,
  salesPageSlugSchema,
  setSalesPageStatusSchema,
} from "./sales-pages"

const validContent = {
  slug: "example",
  meta: { title: "t", description: "d" },
  style: { preset: "clean" as const },
  hero: { headline: "h", subheadline: "s", cta: { label: "Buy", href: "/x" } },
  painPoints: { heading: "h", items: ["a"] },
  solution: { heading: "h", description: "d" },
  modules: { heading: "h", items: [{ title: "t", content: "c", outcome: "o" }] },
  testimonials: { heading: "h", items: [{ quote: "q", name: "n", role: "r" }] },
  pricing: { heading: "h", price: 100, deadline: "2030-01-01T00:00:00.000Z", cta: { label: "Buy", href: "/x" } },
  riskReversal: { heading: "h", guaranteeDays: 30, description: "d" },
  faq: { heading: "h", items: [{ question: "q", answer: "a" }] },
}

describe("salePageSlugSchema", () => {
  it.each(["a", "my-course", "course-2026", "ab-cd-ef"])("accepts %j", (s) => {
    expect(salesPageSlugSchema.safeParse(s).success).toBe(true)
  })

  it.each(["", "Upper", "has space", "trailing-", "-leading", "under_score", "dot.dot"])(
    "rejects %j",
    (s) => {
      expect(salesPageSlugSchema.safeParse(s).success).toBe(false)
    },
  )
})

describe("createSalesPageSchema", () => {
  it("accepts a valid page and defaults status/renderMode", () => {
    const parsed = createSalesPageSchema.parse({ slug: "x", content: validContent })
    expect(parsed.status).toBe("draft")
    expect(parsed.renderMode).toBe("structured")
    expect(parsed.productId).toBeNull()
  })

  it("normalises empty-string productId to null", () => {
    const parsed = createSalesPageSchema.parse({ slug: "x", productId: "", content: validContent })
    expect(parsed.productId).toBeNull()
  })

  it("accepts a uuid productId", () => {
    const id = "11111111-1111-1111-1111-111111111111"
    const parsed = createSalesPageSchema.parse({ slug: "x", productId: id, content: validContent })
    expect(parsed.productId).toBe(id)
  })

  it("rejects a non-uuid productId", () => {
    expect(
      createSalesPageSchema.safeParse({ slug: "x", productId: "not-a-uuid", content: validContent })
        .success,
    ).toBe(false)
  })

  it("rejects content with a bad style preset (bad payload can't reach the column)", () => {
    const bad = { ...validContent, style: { preset: "neon" } }
    expect(createSalesPageSchema.safeParse({ slug: "x", content: bad }).success).toBe(false)
  })

  it("rejects content missing a required section", () => {
    const bad: Record<string, unknown> = { ...validContent }
    delete bad.faq
    expect(createSalesPageSchema.safeParse({ slug: "x", content: bad }).success).toBe(false)
  })

  it("rejects a negative price in content", () => {
    const bad = { ...validContent, pricing: { ...validContent.pricing, price: -1 } }
    expect(createSalesPageSchema.safeParse({ slug: "x", content: bad }).success).toBe(false)
  })
})

describe("setSalesPageStatusSchema", () => {
  it("accepts a valid status flip", () => {
    const id = "11111111-1111-1111-1111-111111111111"
    expect(setSalesPageStatusSchema.safeParse({ id, status: "published" }).success).toBe(true)
  })

  it("rejects an unknown status", () => {
    const id = "11111111-1111-1111-1111-111111111111"
    expect(setSalesPageStatusSchema.safeParse({ id, status: "archived" }).success).toBe(false)
  })
})
