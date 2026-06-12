/* ============================================================================
 * E2E HELPER — Theme + Preset switcher for VRT
 *
 * The design system has two orthogonal axes:
 *   1. Theme  — colors / fonts / radii (CSS vars under [data-theme="..."])
 *   2. Preset — layout density, class strings, glyphs (module-level singleton
 *               in src/components/ui/preset.ts).
 *
 * For Phase A (smoke matrix) we only exercise theme="dark" + preset="default".
 * The helper still accepts both axes so Phase B can extend to the full matrix
 * without re-authoring the spec.
 *
 * Theme is set by mutating `document.documentElement[data-theme]` directly,
 * which matches what `ThemeProvider` does. We also mirror the Zustand persist
 * key (`app-theme`) so a subsequent navigation (which re-runs ThemeProvider)
 * keeps the value stable.
 *
 * Preset switching is driven through the `window.__setActivePreset` bridge
 * mounted (dev / e2e only) in src/main.tsx (E211). The active preset is a
 * module-level singleton inside the bundle; the bridge flips it at runtime so
 * both "default" and "compact" can be exercised by the Phase B matrix.
 *
 * IMPORTANT: call `setThemeAndPreset` BEFORE navigating to the route under
 * test. The preset flip updates the module singleton; primitives read it on
 * their next mount, so the subsequent `page.goto(path)` renders with the
 * requested preset. We seed the bridge via `addInitScript` too, so a preset
 * applied before the bundle boots survives the first paint.
 * ============================================================================ */

import type { Page } from "@playwright/test";

export type Theme =
  | "dark"
  | "indigo"
  | "navy"
  | "sage"
  | "rose"
  | "forest";

export type Preset = "default" | "compact";

export interface ThemePresetOptions {
  theme: Theme;
  preset: Preset;
}

/**
 * Apply theme + preset BEFORE navigating to the target page.
 *
 * Usage:
 *   await page.goto("about:blank");
 *   await setThemeAndPreset(page, { theme: "dark", preset: "default" });
 *   await page.goto("/dashboard");
 *
 * Or after a navigation — the helper waits for fonts + idle network so the
 * screenshot is stable.
 */
export async function setThemeAndPreset(
  page: Page,
  { theme, preset }: ThemePresetOptions,
): Promise<void> {
  // Seed Zustand persist store BEFORE the React app boots so ThemeProvider
  // hydrates with the correct theme on first paint. Also set the attribute
  // directly in case we're already past hydration.
  await page.addInitScript((t: Theme) => {
    try {
      window.localStorage.setItem(
        "app-theme",
        JSON.stringify({ state: { theme: t }, version: 0 }),
      );
    } catch {
      /* localStorage may be unavailable on about:blank — ignore */
    }
  }, theme);

  // Seed the preset BEFORE the bundle boots: queue a call to the
  // `window.__setActivePreset` bridge (E211, mounted in src/main.tsx) the
  // moment it becomes available, so the very first paint of the next
  // navigation renders with the requested preset. Polls briefly because the
  // bridge attaches synchronously during bundle init, which runs after this
  // init script.
  await page.addInitScript((p: Preset) => {
    type Bridge = (name: Preset) => void;
    const apply = () => {
      const w = window as unknown as { __setActivePreset?: Bridge };
      if (typeof w.__setActivePreset === "function") {
        w.__setActivePreset(p);
        return true;
      }
      return false;
    };
    if (!apply()) {
      let tries = 0;
      const id = setInterval(() => {
        if (apply() || ++tries > 50) clearInterval(id);
      }, 10);
    }
  }, preset);

  // If a document is already loaded, mirror the attribute change so a screenshot
  // taken without re-navigating still picks up the new theme.
  await page
    .evaluate((t: Theme) => {
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.setAttribute("data-theme", t);
      }
    }, theme)
    .catch(() => {
      /* about:blank or before navigation — ignore */
    });

  // Preset axis (E211): flip the active preset via the runtime bridge mounted
  // in src/main.tsx. If a document is already loaded the call lands immediately;
  // on about:blank / pre-navigation it is a silent no-op (the addInitScript
  // above re-applies it once the bundle boots).
  await page
    .evaluate((p: Preset) => {
      const w = window as unknown as {
        __setActivePreset?: (name: Preset) => void;
      };
      if (typeof w.__setActivePreset === "function") {
        w.__setActivePreset(p);
      }
    }, preset)
    .catch(() => {
      /* bridge not mounted yet (about:blank / before navigation) — fine */
    });

  // Preset changes swap class strings (not just CSS vars), so primitives must
  // re-mount to pick them up. Give the renderer a beat to settle before the
  // caller navigates / screenshots. waitForVisualReady adds the final settle.
  await page.waitForTimeout(50).catch(() => {
    /* page may be closing — best effort */
  });
}

/**
 * Wait for fonts + network + theme transitions to settle so the screenshot
 * pixel-diff is stable. Call this AFTER the target page is loaded.
 */
export async function waitForVisualReady(page: Page): Promise<void> {
  // 1. Network idle — pending fetches (e.g. /me, route-map) finish.
  await page.waitForLoadState("networkidle").catch(() => {
    /* some pages keep long-poll connections — best effort */
  });

  // 2. Fonts loaded — Google Fonts can finish after the React render commits.
  await page
    .evaluate(async () => {
      if (
        typeof document !== "undefined" &&
        "fonts" in document &&
        document.fonts &&
        typeof document.fonts.ready?.then === "function"
      ) {
        await document.fonts.ready;
      }
    })
    .catch(() => {
      /* fonts API unavailable — best effort */
    });

  // 3. Settle CSS transitions (theme switch animates `color` / `background`).
  await page.waitForTimeout(250);
}
