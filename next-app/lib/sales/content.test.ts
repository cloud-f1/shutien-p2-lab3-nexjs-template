import { describe, expect, it } from "vitest"

import {
  DEFAULT_SECTION_ORDER,
  getConfigSalesPageSlugs,
  getConfigSalesPageContent,
  salesPageContentSchema,
} from "@/lib/sales/content"

describe("getConfigSalesPageContent (resolver)", () => {
  it("returns validated content for a known slug", () => {
    const content = getConfigSalesPageContent("ai-writing-course")
    expect(content).toBeDefined()
    expect(content?.slug).toBe("ai-writing-course")
    expect(content?.style.preset).toBe("bold")
  })

  it("returns undefined for an unknown slug (route should 404)", () => {
    expect(getConfigSalesPageContent("does-not-exist")).toBeUndefined()
  })

  it("exposes at least two example slugs demonstrating different presets", () => {
    const slugs = getConfigSalesPageSlugs()
    expect(slugs.length).toBeGreaterThanOrEqual(2)
    const presets = new Set(slugs.map((slug) => getConfigSalesPageContent(slug)?.style.preset))
    expect(presets.size).toBeGreaterThanOrEqual(2)
  })

  it("every registered slug parses cleanly against the Zod schema", () => {
    for (const slug of getConfigSalesPageSlugs()) {
      const content = getConfigSalesPageContent(slug)
      expect(() => salesPageContentSchema.parse(content)).not.toThrow()
    }
  })

  it("second example demonstrates a reordered/reduced sectionOrder", () => {
    const content = getConfigSalesPageContent("premium-mentorship")
    expect(content?.style.sectionOrder).toBeDefined()
    expect(content?.style.sectionOrder).not.toEqual(DEFAULT_SECTION_ORDER)
    expect(content?.style.sectionOrder?.length).toBeLessThan(DEFAULT_SECTION_ORDER.length)
  })
})

describe("salesPageContentSchema (Zod validation)", () => {
  const validMinimal = {
    slug: "example",
    meta: { title: "t", description: "d" },
    style: { preset: "clean" as const },
    hero: { headline: "h", subheadline: "s", cta: { label: "Buy", href: "/x" } },
    painPoints: { heading: "h", items: ["a"] },
    solution: { heading: "h", description: "d" },
    modules: { heading: "h", items: [{ title: "t", content: "c", outcome: "o" }] },
    testimonials: { heading: "h", items: [{ quote: "q", name: "n", role: "r" }] },
    pricing: {
      heading: "h",
      price: 100,
      deadline: "2030-01-01T00:00:00.000Z",
      cta: { label: "Buy", href: "/x" },
    },
    riskReversal: { heading: "h", guaranteeDays: 30, description: "d" },
    faq: { heading: "h", items: [{ question: "q", answer: "a" }] },
  }

  it("accepts a minimal valid content object and defaults currency to TWD", () => {
    const parsed = salesPageContentSchema.parse(validMinimal)
    expect(parsed.pricing.currency).toBe("TWD")
  })

  it("rejects content missing a required section (e.g. faq)", () => {
    const missingFaq: Record<string, unknown> = { ...validMinimal }
    delete missingFaq.faq
    expect(() => salesPageContentSchema.parse(missingFaq)).toThrow()
  })

  it("rejects an empty pain-points items array", () => {
    const invalid = { ...validMinimal, painPoints: { heading: "h", items: [] } }
    expect(() => salesPageContentSchema.parse(invalid)).toThrow()
  })

  it("rejects an invalid style preset", () => {
    const invalid = { ...validMinimal, style: { preset: "neon" } }
    expect(() => salesPageContentSchema.parse(invalid)).toThrow()
  })

  it("rejects a negative price", () => {
    const invalid = { ...validMinimal, pricing: { ...validMinimal.pricing, price: -1 } }
    expect(() => salesPageContentSchema.parse(invalid)).toThrow()
  })
})
