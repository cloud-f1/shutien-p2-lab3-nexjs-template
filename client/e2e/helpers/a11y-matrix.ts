/* ============================================================================
 * E212 — Cross-theme/preset a11y matrix — shared cell list + sweep helpers
 *
 * E177 shipped the axe-core [a11y] project but only ever ran the single
 * (theme=dark, preset=default) cell. The design system has two orthogonal
 * visual axes — 6 themes × 2 presets — and a fork that re-themes or swaps
 * presets can regress WCAG 2.1 AA (most plausibly a contrast-ratio failure
 * in a palette E177 never ran through axe) entirely undetected.
 *
 * This helper exports the full 6 × 2 = 12-cell cross-product plus the
 * shared zero-violation sweep body, so a11y.spec.ts and
 * a11y-primitives.spec.ts can loop every cell while staying under the
 * Stop-Verifier 200-line limit.
 *
 * Discipline (carried over from E177, a11y.spec.ts:19-22):
 *   - Fails on ANY violation (no impact filtering, no rule allowlist).
 *   - If a cell surfaces a violation, fix the primitive / theme token —
 *     never add a `disableRules` allowlist.
 *
 * See docs/design/A11Y_BASELINE.md for the full contract + add-a-cell recipe.
 * ============================================================================ */

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Theme, Preset } from "./theme-preset";
import { runAxe, formatViolations } from "./a11y-runner";

/** The 6 themes that ship today (styles/themes.css [data-theme] blocks). */
export const A11Y_THEMES: readonly Theme[] = [
  "dark",
  "indigo",
  "navy",
  "sage",
  "rose",
  "forest",
] as const;

/** The 2 presets that ship today (components/ui/preset.ts slot maps). */
export const A11Y_PRESETS: readonly Preset[] = ["default", "compact"] as const;

export interface A11yCell {
  theme: Theme;
  preset: Preset;
}

/**
 * Cartesian product of every shipping theme × preset = 12 cells. Each cell
 * is fed to `setThemeAndPreset(page, cell)` so the page matrix runs in every
 * visual combination, proving WCAG AA is theme-and-preset-invariant.
 */
export const A11Y_CELLS: readonly A11yCell[] = A11Y_THEMES.flatMap((theme) =>
  A11Y_PRESETS.map((preset) => ({ theme, preset })),
);

/** Human-readable cell label for test titles + failure logs. */
export function cellLabel(cell: A11yCell): string {
  return `${cell.theme}/${cell.preset}`;
}

/**
 * Run axe against the current page, log a compact + full report on failure,
 * and assert ZERO violations. Lifts the body that E177 inlined at every
 * sweep site (a11y.spec.ts:72-84) so the page + primitive specs share one
 * disciplined implementation.
 */
export async function sweepZeroViolations(
  page: Page,
  label: string,
  path: string,
): Promise<void> {
  const violations = await runAxe(page);
  if (violations.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[a11y] ${label} (${path}) — ${violations.length} violation(s):\n` +
        formatViolations(
          violations as Parameters<typeof formatViolations>[0],
        ) +
        `\n\nFull report:\n${JSON.stringify(violations, null, 2)}`,
    );
  }
  expect(
    violations,
    `Expected zero a11y violations on ${path} [${label}]; got ${violations.length}.`,
  ).toHaveLength(0);
}

/* --------------------- Interaction-sweep DOM probes ------------------------ */
/* Shared between a11y-interaction.spec.ts checks (axe-blind use-cases). Kept
 * here so the interaction spec stays under the 200-line Stop-Verifier limit. */

/** Is the active element a real, on-screen, visible control (not body)? */
export function activeIsVisibleOnScreen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const inX = r.right > 0 && r.left < window.innerWidth;
    const inY = r.bottom > 0 && r.top < window.innerHeight;
    const s = getComputedStyle(el);
    return inX && inY && s.visibility !== "hidden" && s.display !== "none";
  });
}

/** Does the currently-focused element render a visible focus indicator? */
export function activeHasFocusRing(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return (
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
      s.boxShadow !== "none"
    );
  });
}

/** Is focus currently inside the open dialog? */
export function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return (
      !!d && !!document.activeElement && d.contains(document.activeElement)
    );
  });
}

/** Tag names of elements still running a transition/animation (max 6). */
export function elementsWithActiveMotion(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = [];
    const toMs = (v: string) =>
      v
        .split(",")
        .map((s) => {
          const n = parseFloat(s);
          return s.trim().endsWith("ms") ? n : n * 1000;
        })
        .reduce((a, b) => Math.max(a, b), 0);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      const s = getComputedStyle(el);
      if (toMs(s.transitionDuration) > 1 || toMs(s.animationDuration) > 1) {
        bad.push(el.tagName.toLowerCase());
        if (bad.length > 5) break;
      }
    }
    return bad;
  });
}
