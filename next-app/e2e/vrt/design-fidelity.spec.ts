/**
 * Visual-regression (VRT) — design-fidelity gate (Phase 61, "looks like the design").
 *
 * Screenshots the design-stable surfaces in light + dark and diffs against
 * committed baselines. Runs only in the `vrt` Playwright project
 * (reducedMotion="reduce" → the Cobalt FX self-disable → deterministic shots).
 *
 *   pnpm test:vrt           # compare against baselines
 *   pnpm test:vrt:update    # (re)generate baselines for THIS platform
 *   scripts/smoke.sh --vrt  # gated smoke run
 *
 * NOTE: the dashboard data-viz page is intentionally NOT here — live charts +
 * counts make pixel-VRT flaky; it's covered by functional e2e + the structural
 * alignment suite. Settings/components capture the dashboard shell instead.
 */
import { test, expect, type Page } from "@playwright/test"

import { loginAs, SEED_ADMIN } from "../helpers/auth"

const THEMES = ["light", "dark"] as const

async function snapThemed(page: Page, url: string, name: string) {
  // Disable motion at the page level → the Cobalt FX (aurora/shimmer/reveal/
  // count-up) self-disable via prefers-reduced-motion → deterministic shots.
  await page.emulateMedia({ reducedMotion: "reduce" })
  for (const theme of THEMES) {
    await page.goto(url)
    await page.evaluate((t) => localStorage.setItem("theme", t), theme)
    await page.reload()
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot(`${name}-${theme}.png`, { fullPage: true })
  }
}

test.describe("VRT — public surfaces", () => {
  test("landing", async ({ page }) => {
    await snapThemed(page, "/", "landing")
  })
  test("login", async ({ page }) => {
    await snapThemed(page, "/login", "login")
  })
  test("register", async ({ page }) => {
    await snapThemed(page, "/register", "register")
  })
})

test.describe("VRT — authenticated shell", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN.email, SEED_ADMIN.password)
  })
  test("settings", async ({ page }) => {
    await snapThemed(page, "/dashboard/settings", "settings")
  })
  test("components", async ({ page }) => {
    await snapThemed(page, "/dashboard/components", "components")
  })
})
