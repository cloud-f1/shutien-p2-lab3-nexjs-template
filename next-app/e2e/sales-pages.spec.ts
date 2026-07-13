import { test, expect } from "@playwright/test"

// E333 — sales-page render-mode smoke. Proves BOTH forks of the `/p/[slug]`
// registry resolve: a slug registered in lib/sales/custom-pages.ts renders the
// hand-authored TSX (tier 3 / custom), and an unregistered slug falls through to
// the structured renderer (tier 2 / E326 sections). Requires the seed DB
// (`pnpm db:seed`) — both slugs are seeded there. No live gateway is hit: the
// custom-page CTA is asserted present + opens the email-capture dialog, but we
// never submit a real checkout.
test.describe("Sales pages — render-mode fork", () => {
  test("custom slug renders the hand-authored custom page + wired CTA", async ({ page }) => {
    await page.goto("/p/ai-launch-intensive")

    // The custom page root marker (only the E333 custom TSX renders this).
    await expect(page.getByTestId("custom-sales-page")).toBeVisible()
    // Its bespoke headline (not a structured section heading).
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI")

    // CTA is present and, when clicked, opens the guest-email checkout dialog
    // (E327 wiring) — we stop there, never submitting a real gateway checkout.
    const cta = page.getByRole("button", { name: "立即報名特訓營" }).first()
    await expect(cta).toBeVisible()
    await cta.click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByLabel("電子郵件")).toBeVisible()
  })

  test("unregistered slug renders the structured section renderer", async ({ page }) => {
    await page.goto("/p/ai-writing-course")

    // No custom marker — this slug is NOT in the registry, so the structured
    // renderer (E326 sections) handles it.
    await expect(page.getByTestId("custom-sales-page")).toHaveCount(0)
    // A structured section heading from the seeded config content is visible.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })
})
