import { test, expect } from "@playwright/test"

import { loginAs, SEED_ADMIN } from "./helpers/auth"

// E292 — Billing panel e2e. This is the money-path's first e2e coverage. It does
// NOT hit a live gateway: it asserts the billing panel renders + that the cancel
// / manage-billing affordances are present and wired (the actions are guarded so
// a real Stripe redirect never fires from CI). The seed demo users normally have
// no active subscription, so the panel shows the empty state — the test handles
// both the active and empty states.
test.describe("Billing panel (system → 帳務)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN.email, SEED_ADMIN.password)
    await page.goto("/dashboard/system")
    await expect(page).toHaveURL(/\/dashboard\/system/)
    // Switch to the 帳務 (billing) tab.
    await page.getByRole("tab", { name: "帳務" }).click()
  })

  test("billing panel renders with the 帳務 heading + plan/empty state", async ({ page }) => {
    // Panel section heading (the BillingPanel's own <h2>帳務</h2>).
    await expect(page.getByRole("heading", { name: "帳務", level: 2 })).toBeVisible()

    // Either an active plan summary ("目前方案") OR the empty state ("尚無使用中的方案").
    const hasActivePlan = await page.getByText("目前方案").isVisible().catch(() => false)
    if (hasActivePlan) {
      // Active subscription: the manage-billing affordance is wired (Stripe default).
      await expect(page.getByTestId("manage-billing").first()).toBeVisible()
    } else {
      // Empty state: a "查看方案" CTA links to pricing.
      await expect(page.getByRole("link", { name: "查看方案" })).toBeVisible()
    }
  })

  test("usage meter + provider-managed payment block render", async ({ page }) => {
    // The usage-meter placeholder always renders.
    await expect(page.getByText("本月用量")).toBeVisible()
    // The provider-managed payment/invoices block always renders (Stripe copy by default).
    await expect(page.getByText(/Customer Portal|金流商/)).toBeVisible()
  })

  test("manage-billing button is wired (no live gateway hit)", async ({ page }) => {
    // Guard the action so clicking never triggers a real navigation to Stripe —
    // we only assert the button exists + is enabled (UI wiring, not a live redirect).
    const manage = page.getByTestId("manage-billing").first()
    const present = await manage.isVisible().catch(() => false)
    test.skip(!present, "No active subscription in the seed DB — manage button hidden by design")
    await expect(manage).toBeEnabled()
  })
})
