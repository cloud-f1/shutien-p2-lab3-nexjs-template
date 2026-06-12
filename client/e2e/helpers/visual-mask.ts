/* ============================================================================
 * E2E HELPER — Visual mask selectors
 *
 * Selectors for regions that change between runs and would cause a VRT diff
 * even when no design change occurred. Pass `mask: visualMaskSelectors(page)`
 * to `page.screenshot()` or `expect(page).toHaveScreenshot()`.
 *
 * Keep this list TIGHT — over-masking hides real regressions. Only add a
 * selector when you've seen it produce a flake in CI.
 * ============================================================================ */

import type { Locator, Page } from "@playwright/test";

/** CSS selectors for volatile regions to mask in screenshots. */
export const VISUAL_MASK_SELECTORS: readonly string[] = [
  // Native <time> elements (timestamps, last-updated).
  "time",
  // Explicit testids for live-updating regions.
  '[data-testid="last-updated"]',
  '[data-testid="server-time"]',
  '[data-testid="request-id"]',
  // UUIDs / random IDs surfaced in debug panels.
  ".random-uuid",
  '[data-volatile="true"]',
  // Animated spinners — frame-dependent; mask so a mid-spin frame doesn't
  // diff a stationary frame.
  ".animate-spin",
  '[role="progressbar"]',
];

/**
 * Resolve the mask selector list to Locator objects bound to `page`. Pass the
 * return value as `mask: ...` to `expect(page).toHaveScreenshot({ mask })` or
 * `page.screenshot({ mask })`.
 */
export function visualMask(page: Page): Locator[] {
  return VISUAL_MASK_SELECTORS.map((selector) => page.locator(selector));
}
