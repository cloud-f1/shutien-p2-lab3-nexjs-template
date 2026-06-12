/* ============================================================================
 * E177 + E212 — Accessibility Audit Sweep — primitive interactions + E130 smoke
 *
 * Sibling to a11y.spec.ts (page matrix). Modal / Drawer / Toast aren't in
 * the DOM until triggered, so they get dedicated interaction specs here.
 *
 * E212 — the Modal + Toast scans now run across the FULL 6 themes × 2 presets
 * matrix (A11Y_CELLS) so the live-region + dialog-shell primitives are proven
 * WCAG AA in every visual combination, not just (dark, default). The shared
 * cell list + zero-violation sweep body live in helpers/a11y-matrix.ts.
 *
 * Also preserves the legacy E130 critical+serious smoke (single cell — it is
 * a theme-invariant regression tripwire) so a regression on the auth pages
 * fails LOUDLY in addition to the full matrix.
 *
 * See docs/design/A11Y_BASELINE.md for context.
 * ============================================================================ */

import { test, expect } from "@playwright/test";
import {
  setThemeAndPreset,
  waitForVisualReady,
} from "./helpers/theme-preset";
import { A11Y_CELLS, cellLabel, sweepZeroViolations } from "./helpers/a11y-matrix";
import { runAxe } from "./helpers/a11y-runner";
import { apiRegister, testEmail, TEST_PASSWORD } from "./fixtures/auth";

/* --------------------------- Primitive sweep ------------------------------- */

for (const cell of A11Y_CELLS) {
  const label = cellLabel(cell);

  test.describe(`a11y — primitive interactions [${label}]`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    let email: string;

    test.beforeAll(async ({ request }) => {
      email = testEmail("a11y-prim");
      await apiRegister(request, email, TEST_PASSWORD).catch(() => undefined);
    });

    /**
     * Modal — opens the "Delete account" confirmation modal in SettingsView
     * (real production surface, no test harness). If SettingsView's button
     * label changes, this spec fails fast with a locator-not-found error
     * rather than silently passing.
     */
    test(`Modal (open state) — zero violations [${label}]`, async ({
      page,
    }) => {
      await setThemeAndPreset(page, cell);

      await page.goto("/signin");
      await page.locator("#si-email").fill(email);
      await page.locator("#si-pw").fill(TEST_PASSWORD);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });

      await setThemeAndPreset(page, cell);
      await page.goto("/dashboard/settings");
      await waitForVisualReady(page);

      const trigger = page.getByRole("button", { name: /delete/i }).first();
      await trigger.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      await sweepZeroViolations(page, `Modal ${label}`, "/dashboard/settings");
    });

    /**
     * Toast / live-region — bad creds on /signin surface a toast or inline
     * `[role="alert"]` banner. Either path exercises the announce-to-AT
     * primitive contract.
     */
    test(`Toast (live region) — zero violations [${label}]`, async ({
      page,
    }) => {
      await setThemeAndPreset(page, cell);

      await page.goto("/signin");
      await waitForVisualReady(page);
      await page.locator("#si-email").fill("nobody@example.com");
      await page.locator("#si-pw").fill("WrongPassword!1");
      await page.locator('button[type="submit"]').click();

      // Wait for either the toast container OR the inline error banner —
      // the auth pages historically render an inline FormBanner; the toast
      // path is exercised by other flows. Either path is a valid live region.
      const toastContainer = page.getByTestId("toast-container");
      const formBanner = page.locator('[role="alert"]').first();
      await Promise.race([
        toastContainer
          .waitFor({ state: "visible", timeout: 6_000 })
          .catch(() => undefined),
        formBanner
          .waitFor({ state: "visible", timeout: 6_000 })
          .catch(() => undefined),
      ]);

      await sweepZeroViolations(page, `Toast ${label}`, "/signin");
    });
  });
}

/* ---------------------------- Legacy E130 smoke ---------------------------- */
/*
 * Preserved verbatim so a critical/serious regression surfaces with the
 * original error format the original epic shipped. Layered ON TOP of the
 * full E177/E212 matrix in a11y.spec.ts — both run in the [a11y] project.
 * Single cell: critical/serious violations are theme-invariant tripwires.
 */

const E130_AUTH_PAGES = [
  { name: "signin", path: "/signin", selector: "#si-email" },
  { name: "signup", path: "/signup", selector: "#su-email" },
  { name: "forgot-password", path: "/forgot-password", selector: "#fp-email" },
] as const;

test.describe("a11y — E130 critical+serious smoke", () => {
  for (const { name, path, selector } of E130_AUTH_PAGES) {
    test(`${name} page has no critical/serious violations`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator(selector)).toBeVisible({ timeout: 10_000 });

      const critical = await runAxe(page, {
        failOnImpacts: ["critical", "serious"],
      });

      if (critical.length > 0) {
        // eslint-disable-next-line no-console
        console.error(
          `[a11y][E130] ${name} — ${critical.length} violation(s):`,
          JSON.stringify(
            critical.map((v) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              nodes: v.nodes.map((n) => n.html),
            })),
            null,
            2,
          ),
        );
      }
      expect(critical).toEqual([]);
    });
  }
});
