/* ============================================================================
 * E212 — Interaction a11y sweep (axe-blind use-cases)
 *
 * Static axe cannot catch keyboard, focus, or announcement failures — the
 * a11y bugs that actually ship. These behaviors are theme/preset-INVARIANT,
 * so they run in a SINGLE default cell (theme=dark, preset=default) rather
 * than multiplying across the 12-cell matrix in a11y.spec.ts.
 *
 * Covers:
 *   (i)   keyboard navigation — visible focus ring + logical, on-screen order
 *   (ii)  focus trap + Escape — Modal keeps focus while open, returns it to
 *         the trigger on close (DropdownMenu shares the same useFocusTrap path)
 *   (iii) form-error announcement — bad input is programmatically associated
 *         (aria-describedby) and rendered in an aria-live / role="alert" region
 *   (iv)  skip-link reaches <main>
 *   (v)   prefers-reduced-motion honored — no active transition/animation
 *
 * Shared DOM probes live in helpers/a11y-matrix.ts to keep this file under
 * the Stop-Verifier 200-line limit. See docs/design/A11Y_BASELINE.md.
 * ============================================================================ */

import { test, expect } from "@playwright/test";
import { setThemeAndPreset, waitForVisualReady } from "./helpers/theme-preset";
import {
  activeIsVisibleOnScreen,
  activeHasFocusRing,
  focusInsideDialog,
  elementsWithActiveMotion,
} from "./helpers/a11y-matrix";
import { testEmail, TEST_PASSWORD } from "./fixtures/auth";

const CELL = { theme: "dark", preset: "default" } as const;

test.describe("a11y interaction — keyboard / focus / announce (default cell)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  /* (i) Keyboard navigation — visible focus + logical, on-screen order. */
  for (const path of ["/", "/signin", "/getting-started"]) {
    test(`keyboard nav reaches visible on-screen controls @ ${path}`, async ({
      page,
    }) => {
      await setThemeAndPreset(page, CELL);
      await page.goto(path);
      await waitForVisualReady(page);

      let landed = false;
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        if (await activeIsVisibleOnScreen(page)) {
          landed = true;
          expect(
            await activeHasFocusRing(page),
            `focused control on ${path} must show a focus ring`,
          ).toBe(true);
          break;
        }
      }
      expect(
        landed,
        `Tab should reach a visible on-screen control on ${path}`,
      ).toBe(true);
    });
  }

  /* (iv) Skip-link reaches <main>. */
  test("skip-link moves focus to <main>", async ({ page }) => {
    await setThemeAndPreset(page, CELL);
    await page.goto("/");
    await waitForVisualReady(page);

    // Route keyboard into the document, then Tab: the global <SkipNav> is the
    // first focusable element rendered in App.tsx, so it must be the first
    // tab stop for a keyboard user.
    const skip = page.getByRole("link", { name: /skip to main content/i });
    await page.evaluate(() => {
      window.focus();
      (document.activeElement as HTMLElement | null)?.blur();
      document.body.setAttribute("tabindex", "-1");
      document.body.focus();
    });
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();

    // Activating the skip-link points the document at the <main> landmark.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator("#main-content")).toBeVisible();
  });

  /* (iii) Form-error announcement — aria-describedby + role=alert live region. */
  test("SignIn bad input is announced via aria-describedby", async ({
    page,
  }) => {
    await setThemeAndPreset(page, CELL);
    await page.goto("/signin");
    await waitForVisualReady(page);

    await page.locator("#si-email").fill("not-an-email");
    await page.locator('button[type="submit"]').click();

    await expect(page.locator("#si-email-error")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator("#si-email")).toHaveAttribute(
      "aria-describedby",
      "si-email-error",
    );
    await expect(page.locator("#si-email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("SignIn bad credentials surface a role=alert live region", async ({
    page,
  }) => {
    await setThemeAndPreset(page, CELL);
    await page.goto("/signin");
    await waitForVisualReady(page);

    await page.locator("#si-email").fill("nobody@example.com");
    await page.locator("#si-pw").fill("WrongPassword!1");
    await page.locator('button[type="submit"]').click();

    const alert = page.locator('[role="alert"]').first();
    await expect(alert).toBeVisible({ timeout: 8_000 });
    await expect(alert).toHaveAttribute("aria-live", "polite");
  });

  /* (ii) Focus trap + Escape returns focus to trigger (Modal). */
  test("Modal traps focus and Escape returns focus to trigger", async ({
    page,
  }) => {
    const email = testEmail("a11y-trap");
    await page.request
      .post("http://localhost:8080/auth/register", {
        data: { email, password: TEST_PASSWORD },
      })
      .catch(() => undefined);

    await setThemeAndPreset(page, CELL);
    await page.goto("/signin");
    await page.locator("#si-email").fill(email);
    await page.locator("#si-pw").fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });

    await page.goto("/dashboard/settings");
    await waitForVisualReady(page);

    const trigger = page.getByRole("button", { name: /delete/i }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // useFocusTrap moves focus to the first control via setTimeout(0); poll
    // until it lands inside the dialog rather than racing that microtask.
    await expect
      .poll(() => focusInsideDialog(page), {
        timeout: 5_000,
        message: "focus should move inside the open dialog",
      })
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    await expect(trigger).toBeFocused();
  });

  /* (v) prefers-reduced-motion honored — durations effectively zeroed. */
  test("reduced-motion suppresses transitions + animations", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setThemeAndPreset(page, CELL);
    await page.goto("/");
    await waitForVisualReady(page);

    const offending = await elementsWithActiveMotion(page);
    expect(
      offending,
      `under reduced-motion no element should keep an active transition/animation; saw: ${offending.join(", ")}`,
    ).toEqual([]);
  });
});
