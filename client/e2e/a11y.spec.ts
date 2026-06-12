/* ============================================================================
 * E177 + E212 — Accessibility Audit Sweep — page matrix × theme/preset grid
 *
 * Sweeps every public + auth + dashboard route with axe-core (WCAG 2.1 AA)
 * and asserts ZERO violations per page. E212 extends the original single
 * (theme=dark, preset=default) cell to the FULL 6 themes × 2 presets matrix
 * (A11Y_CELLS), so WCAG AA is proven theme-and-preset-invariant — a fork
 * re-theming or swapping presets cannot silently regress contrast.
 *
 * Primitive interaction scans (Modal / Drawer / Toast) live in the sibling
 * a11y-primitives.spec.ts, and axe-blind keyboard/focus/announcement checks
 * live in a11y-interaction.spec.ts, so each spec file stays under the
 * Stop-Verifier 200-line limit. The cell list + shared sweep body live in
 * helpers/a11y-matrix.ts.
 *
 * Discipline:
 *   - Fails on ANY violation (no impact filtering, no `disableRules`
 *     allowlist). If a cell surfaces a violation, fix the primitive / theme
 *     token — see docs/design/A11Y_BASELINE.md.
 *   - Re-uses theme-preset.ts helpers (E171/E211) so VRT + a11y stay in
 *     lockstep across the same matrix.
 * ============================================================================ */

import { test } from "@playwright/test";
import {
  setThemeAndPreset,
  waitForVisualReady,
} from "./helpers/theme-preset";
import { A11Y_CELLS, cellLabel, sweepZeroViolations } from "./helpers/a11y-matrix";
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

/** Dashboard sub-routes — same matrix as visual.spec.ts. */
const DASHBOARD_PAGES: ReadonlyArray<{ name: string; path: string }> = [
  { name: "dashboard-overview", path: "/dashboard/overview" },
  { name: "dashboard-sessions", path: "/dashboard/sessions" },
  { name: "dashboard-projects", path: "/dashboard/projects" },
  { name: "dashboard-settings", path: "/dashboard/settings" },
];

/* ----------------------------- Public sweep -------------------------------- */

for (const cell of A11Y_CELLS) {
  const label = cellLabel(cell);

  test.describe(`a11y — public surfaces [${label}] (WCAG 2.1 AA)`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    for (const { name, path } of PUBLIC_PAGES) {
      test(`${name} @ ${path} has zero axe violations [${label}]`, async ({
        page,
      }) => {
        await setThemeAndPreset(page, cell);
        await page.goto(path);
        await waitForVisualReady(page);
        await sweepZeroViolations(page, `${name} ${label}`, path);
      });
    }
  });
}

/* ---------------------------- Dashboard sweep ------------------------------ */

for (const cell of A11Y_CELLS) {
  const label = cellLabel(cell);

  test.describe(`a11y — dashboard surfaces [${label}] (auth required)`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    let email: string;

    test.beforeAll(async ({ request }) => {
      email = testEmail("a11y");
      await apiRegister(request, email, TEST_PASSWORD).catch(() => {
        // Backend may be unavailable — individual tests will fail at sign-in
        // and surface a clear error rather than masking it here.
      });
    });

    for (const { name, path } of DASHBOARD_PAGES) {
      test(`${name} @ ${path} has zero axe violations [${label}]`, async ({
        page,
      }) => {
        await setThemeAndPreset(page, cell);

        await page.goto("/signin");
        await page.locator("#si-email").fill(email);
        await page.locator("#si-pw").fill(TEST_PASSWORD);
        await page.locator('button[type="submit"]').click();
        await test.expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });

        await setThemeAndPreset(page, cell);
        await page.goto(path);
        await waitForVisualReady(page);
        await sweepZeroViolations(page, `${name} ${label}`, path);
      });
    }
  });
}
