import { describe, expect, it } from "vitest"

import { getSalesStyleTokens } from "@/lib/sales/styles"

describe("getSalesStyleTokens", () => {
  it("resolves distinct token bundles for bold/premium/clean", () => {
    const bold = getSalesStyleTokens("bold")
    const premium = getSalesStyleTokens("premium")
    const clean = getSalesStyleTokens("clean")

    expect(bold).not.toEqual(premium)
    expect(bold).not.toEqual(clean)
    expect(premium).not.toEqual(clean)
  })

  it("never emits inline-style-like values — only Tailwind utility class strings", () => {
    for (const preset of ["bold", "premium", "clean"] as const) {
      const tokens = getSalesStyleTokens(preset)
      for (const value of Object.values(tokens)) {
        expect(value).not.toMatch(/#[0-9a-f]{3,6}/i)
        expect(value).not.toMatch(/rgb\(|oklch\(/)
      }
    }
  })
})
