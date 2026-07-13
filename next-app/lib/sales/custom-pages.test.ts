import { describe, expect, it } from "vitest"

import {
  getCustomSalesPageLoader,
  getCustomSalesSlugs,
  isCustomSalesSlug,
} from "@/lib/sales/custom-pages"

/**
 * Registry-resolution-order tests (E333). The `/p/[slug]` route MUST check the
 * custom registry first and only fall through to the structured renderer for
 * unregistered slugs — these assertions pin that contract without touching the
 * DB or rendering React (registry lookups are pure + db-free by design).
 */
describe("custom sales-page registry", () => {
  it("returns a lazy loader for a registered slug", () => {
    const loader = getCustomSalesPageLoader("ai-launch-intensive")
    expect(loader).toBeTypeOf("function")
  })

  it("returns undefined for an unregistered slug (→ structured fallback)", () => {
    expect(getCustomSalesPageLoader("ai-writing-course")).toBeUndefined()
    expect(getCustomSalesPageLoader("does-not-exist")).toBeUndefined()
  })

  it("isCustomSalesSlug agrees with the loader lookup", () => {
    expect(isCustomSalesSlug("ai-launch-intensive")).toBe(true)
    expect(isCustomSalesSlug("ai-writing-course")).toBe(false)
    expect(isCustomSalesSlug("")).toBe(false)
  })

  it("is not fooled by inherited Object.prototype keys", () => {
    // A slug of "toString"/"constructor" must not resolve to a bogus loader.
    expect(getCustomSalesPageLoader("toString")).toBeUndefined()
    expect(isCustomSalesSlug("constructor")).toBe(false)
  })

  it("getCustomSalesSlugs lists exactly the registered slugs", () => {
    const slugs = getCustomSalesSlugs()
    expect(slugs).toContain("ai-launch-intensive")
    // Every listed slug must resolve to a loader (registry stays internally consistent).
    // NB: we never CALL the loader here — invoking the import() thunk would pull
    // the page bundle (→ the checkout action → @/lib/db, which throws without a
    // DATABASE_URL). Resolution order is fully specified by the lookups alone.
    for (const slug of slugs) {
      expect(getCustomSalesPageLoader(slug)).toBeTypeOf("function")
      expect(isCustomSalesSlug(slug)).toBe(true)
    }
  })
})
