/* ============================================================================
 * E211 — Visual Regression — Phase B full matrix
 *
 * Captures the full design-system cross-product as a versioned visual contract:
 *
 *   14 pages × 6 themes × 2 presets × 2 viewports = 336 baselines
 *
 *   pages     = PUBLIC_PAGES (10) + DASHBOARD_PAGES (4)
 *   themes    = dark · indigo · navy · sage · rose · forest   (union of themes.css)
 *   presets   = default · compact                             (components/ui/preset.ts)
 *   viewports = desktop 1280×800 · mobile 390×844
 *
 * Each cell's snapshot name encodes every axis so it is uniquely addressable:
 *   `${name}--${theme}--${preset}--${viewport}.png`
 *
 * Plus a small, BOUNDED set of critical-STATE snapshots (default theme/preset/
 * desktop only — these renders are state-driven, not theme-driven, so cross-
 * producting them ×24 would explode the baseline count for little signal):
 *   `${name}--state-${state}.png`
 *
 * Baselines are captured against a LIVE LOCAL dev-server (CI stays off):
 *   pnpm test:e2e --project=visual --update-snapshots
 *
 * See docs/guides/zh-TW/vrt-baseline-capture.md for the capture runbook.
 * ============================================================================ */

import { test, expect, type Page } from "@playwright/test";
import {
  setThemeAndPreset,
  waitForVisualReady,
  type Theme,
  type Preset,
} from "./helpers/theme-preset";
import { visualMask } from "./helpers/visual-mask";
import { apiRegister, testEmail, TEST_PASSWORD } from "./fixtures/auth";

/** Public + auth-form pages — no backend session required. */
const PUBLIC_PAGES: ReadonlyArray<{ name: string; path: string }> = [
  { name: "landing", path: "/" },
  { name: "getting-started", path: "/getting-started" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "404", path: "/non-existent" },
  { name: "signin", path: "/signin" },
  { name: "signup", path: "/signup" },
  { name: "forgot-password", path: "/forgot-password" },
  { name: "reset-password", path: "/reset-password" },
  { name: "verify-email", path: "/verify-email?token=test" },
];

/**
 * Dashboard sub-routes (path-based, NOT query-string-based — the React Router
 * config in src/App.tsx + src/config/routeMap.ts uses /dashboard/<view>).
 * Each requires an authenticated session.
 */
const DASHBOARD_PAGES: ReadonlyArray<{ name: string; path: string }> = [
  { name: "dashboard-overview", path: "/dashboard/overview" },
  { name: "dashboard-sessions", path: "/dashboard/sessions" },
  { name: "dashboard-projects", path: "/dashboard/projects" },
  { name: "dashboard-settings", path: "/dashboard/settings" },
];

/** Theme axis — union of themes.css `[data-theme="..."]` blocks. */
const THEMES: ReadonlyArray<Theme> = [
  "dark",
  "indigo",
  "navy",
  "sage",
  "rose",
  "forest",
];

/** Preset axis — the two presets that ship today (default + compact). */
const PRESETS: ReadonlyArray<Preset> = ["default", "compact"];

/** Viewport axis — desktop + mobile. */
const VIEWPORTS: ReadonlyArray<{
  name: string;
  width: number;
  height: number;
}> = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

/** Snapshot name for a matrix cell: page+theme+preset+viewport. */
function cellName(
  name: string,
  theme: Theme,
  preset: Preset,
  viewport: string,
): string {
  return `${name}--${theme}--${preset}--${viewport}.png`;
}

/** Sign in via the UI as a pre-registered user, landing on the dashboard. */
async function signInViaUi(page: Page, email: string): Promise<void> {
  await page.goto("/signin");
  await page.locator("#si-email").fill(email);
  await page.locator("#si-pw").fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
}

/* ──────────────────────────────────────────────────────────────────────────
 * FULL MATRIX — public surfaces × 6 themes × 2 presets × 2 viewports
 * 10 pages × 6 × 2 × 2 = 240 cells
 * ────────────────────────────────────────────────────────────────────────── */

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const preset of PRESETS) {
      test.describe(`VRT public — ${theme}/${preset}/${viewport.name}`, () => {
        test.use({
          viewport: { width: viewport.width, height: viewport.height },
        });

        for (const { name, path } of PUBLIC_PAGES) {
          test(`${name} @ ${path}`, async ({ page }) => {
            await setThemeAndPreset(page, { theme, preset });
            await page.goto(path);
            await waitForVisualReady(page);

            await expect(page).toHaveScreenshot(
              cellName(name, theme, preset, viewport.name),
              { fullPage: true, mask: visualMask(page) },
            );
          });
        }
      });
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * FULL MATRIX — dashboard surfaces (auth required) × 6 × 2 × 2
 * 4 pages × 6 × 2 × 2 = 96 cells   →   240 + 96 = 336 total
 * ────────────────────────────────────────────────────────────────────────── */

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const preset of PRESETS) {
      test.describe(`VRT dashboard — ${theme}/${preset}/${viewport.name}`, () => {
        test.use({
          viewport: { width: viewport.width, height: viewport.height },
        });

        let email: string;

        // One registered user per (theme×preset×viewport) describe block.
        test.beforeAll(async ({ request }) => {
          email = testEmail("vrt");
          await apiRegister(request, email, TEST_PASSWORD).catch(() => {
            /* Backend may be unavailable — individual tests will surface it. */
          });
        });

        for (const { name, path } of DASHBOARD_PAGES) {
          test(`${name} @ ${path}`, async ({ page }) => {
            // Pre-set theme + preset so first paint is correct.
            await setThemeAndPreset(page, { theme, preset });

            await signInViaUi(page, email);

            // Re-apply after auth navigation (ThemeProvider re-mounts).
            await setThemeAndPreset(page, { theme, preset });

            await page.goto(path);
            await waitForVisualReady(page);

            await expect(page).toHaveScreenshot(
              cellName(name, theme, preset, viewport.name),
              { fullPage: true, mask: visualMask(page) },
            );
          });
        }
      });
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * CRITICAL-STATE SNAPSHOTS (E211 step 4b) — bounded set.
 *
 * Default theme + default preset + desktop viewport ONLY. These renders are
 * state-driven (validation / error / empty), not theme-driven; cross-producting
 * them across all 24 visual combos is deferred (baseline explosion for marginal
 * signal). The 404 (NotFoundPage) is already covered by the full matrix above.
 *
 * Set: 3 state snapshots here (signin-validation-error, reset-password-invalid-
 * token, dashboard-sessions-empty) + 404 in the matrix = the bounded 4–6 set.
 * ────────────────────────────────────────────────────────────────────────── */

const STATE_THEME: Theme = "dark";
const STATE_PRESET: Preset = "default";

test.describe("VRT critical-state — default theme/preset/desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // (i) SignIn validation-error — submit empty form → field errors render.
  test("signin -- validation error", async ({ page }) => {
    await setThemeAndPreset(page, {
      theme: STATE_THEME,
      preset: STATE_PRESET,
    });
    await page.goto("/signin");
    await waitForVisualReady(page);

    // Submit with no input → Zod resolver surfaces required-field errors.
    await page.locator('button[type="submit"]').click();
    // Wait for the first field-error to appear so the snapshot is stable.
    await page.locator("#si-email-error").waitFor({
      state: "visible",
      timeout: 5_000,
    });
    await waitForVisualReady(page);

    await expect(page).toHaveScreenshot("signin--state-validation-error.png", {
      fullPage: true,
      mask: visualMask(page),
    });
  });

  // (ii) ResetPassword invalid-token — no `token` query param → invalid-link card.
  test("reset-password -- invalid token", async ({ page }) => {
    await setThemeAndPreset(page, {
      theme: STATE_THEME,
      preset: STATE_PRESET,
    });
    // No ?token → ResetPasswordPage renders its invalid-link error branch.
    await page.goto("/reset-password");
    await waitForVisualReady(page);
    // Confirm the error banner is present before snapshotting.
    await page.getByRole("alert").first().waitFor({
      state: "visible",
      timeout: 5_000,
    });

    await expect(page).toHaveScreenshot(
      "reset-password--state-invalid-token.png",
      { fullPage: true, mask: visualMask(page) },
    );
  });

  // (iii) Empty-state dashboard — stub GET /auth/sessions → [] so the sessions
  // DataTable renders its "No active sessions." empty state deterministically.
  test("dashboard-sessions -- empty", async ({ page, request }) => {
    const email = testEmail("vrt-empty");
    await apiRegister(request, email, TEST_PASSWORD).catch(() => {
      /* Backend may be unavailable — sign-in below will surface it. */
    });

    await setThemeAndPreset(page, {
      theme: STATE_THEME,
      preset: STATE_PRESET,
    });

    // Force an empty sessions response so the empty-state path renders.
    await page.route("**/auth/sessions", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
      } else {
        await route.continue();
      }
    });

    await signInViaUi(page, email);
    await setThemeAndPreset(page, {
      theme: STATE_THEME,
      preset: STATE_PRESET,
    });

    await page.goto("/dashboard/sessions");
    await waitForVisualReady(page);
    // Wait for the empty-state copy to render.
    await page.getByText("No active sessions.").waitFor({
      state: "visible",
      timeout: 10_000,
    });

    await expect(page).toHaveScreenshot(
      "dashboard-sessions--state-empty.png",
      { fullPage: true, mask: visualMask(page) },
    );
  });
});
