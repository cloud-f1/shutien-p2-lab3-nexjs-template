/**
 * Visual-regression (VRT) — design-fidelity gate (Phase 61, "looks like the design").
 *
 * Screenshots the design-stable surfaces in light + dark and diffs against
 * LOCAL, PER-MACHINE baselines. Runs only in the `vrt` Playwright project
 * (reducedMotion="reduce" → the Cobalt FX self-disable → deterministic shots).
 *
 *   pnpm test:vrt           # compare against this machine's baselines
 *   pnpm test:vrt:update    # (re)generate baselines for THIS machine
 *   scripts/smoke.sh --vrt  # gated smoke run
 *
 * ── What this suite is, and is not (E374) ─────────────────────────────────
 *
 * The baselines are NOT in version control. `.gitignore` carries a blanket
 * `*.png`, so `design-fidelity.spec.ts-snapshots/` holds whatever THIS machine
 * last recorded. That is deliberate for a template: every fork rebrands (see
 * the `rebrand` skill), and shipped screenshots of the template's own UI would
 * be wrong for them on day one — plus the baselines are platform-suffixed
 * (`-vrt-darwin.png`), so they would not match a Linux CI runner anyway.
 *
 * The consequence has to be stated plainly, because this header used to claim
 * the opposite ("diffs against committed baselines"):
 *
 *   **This suite cannot detect a regression that someone else introduced.**
 *   It compares the app against the last snapshot YOU took. On a fresh clone
 *   there are no baselines at all, and the first run simply records the current
 *   appearance — including any regression already present — as "correct".
 *
 * It is a local before/after tool for whoever is changing UI, not a shared
 * gate. That is why it is absent from `pre-merge-check.sh`: a gate whose
 * baseline every machine defines for itself cannot gate anything.
 *
 * It went three months unnoticed because nothing said any of the above and
 * nothing flagged a stale baseline — four cases had been failing since
 * 2026-06-15 against E296 (GitHub login button), E297 (real 2FA replacing a
 * placeholder), E328/E332 (new sidebar entries) and E337/E338 (widget kit +
 * status primitives). All expected evolution; none of it visible to anyone.
 * The `beforeAll` below is the missing signal.
 *
 * NOTE: the dashboard data-viz page is intentionally NOT here — live charts +
 * counts make pixel-VRT flaky; it's covered by functional e2e + the structural
 * alignment suite. Settings/components capture the dashboard shell instead.
 */
import { test, expect, type Page } from "@playwright/test"

import { loginAs, SEED_ADMIN } from "../helpers/auth"

const THEMES = ["light", "dark"] as const

/**
 * E374 — warn when this machine's baselines predate the UI they claim to pin.
 *
 * Not a failure: a stale baseline is a reason to look, not a reason to block,
 * and the person running VRT is usually about to regenerate anyway. But
 * "silently comparing against June" is exactly how four cases rotted for three
 * months, so it gets one loud line.
 */
test.beforeAll(async () => {
  const { statSync, readdirSync, existsSync } = await import("node:fs")
  const { join, dirname } = await import("node:path")
  const { fileURLToPath } = await import("node:url")

  const here = dirname(fileURLToPath(import.meta.url))
  const snapDir = join(here, "design-fidelity.spec.ts-snapshots")
  if (!existsSync(snapDir)) {
    console.warn(
      "[vrt] no baselines on this machine — the first run RECORDS the current\n" +
        "      appearance as correct, including any regression already present.\n" +
        "      That is the documented contract (see this file's header), not a bug.",
    )
    return
  }

  const newest = (dir: string): number => {
    let max = 0
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
      const full = join(dir, entry.name)
      max = Math.max(max, entry.isDirectory() ? newest(full) : statSync(full).mtimeMs)
    }
    return max
  }

  const appRoot = join(here, "..", "..")
  const baselineAge = newest(snapDir)
  const uiAge = Math.max(newest(join(appRoot, "app")), newest(join(appRoot, "components")))

  if (uiAge > baselineAge) {
    const days = Math.round((uiAge - baselineAge) / 86_400_000)
    console.warn(
      `[vrt] baselines are OLDER than app/ + components/ by ~${days} day(s).\n` +
        "      Failures below are as likely to be drift as regression. Inspect the\n" +
        "      diffs in test-results/, then: pnpm test:vrt:update",
    )
  }
})

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
