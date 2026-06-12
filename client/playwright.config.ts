import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const startBackend = isCI || !!process.env.E2E_BACKEND;
const E2E_PORT = Number(process.env.E2E_PORT) || 3100;
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "html",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    // E171 Phase A — VRT tolerance. Allow 1% pixel diff to absorb anti-alias /
    // font sub-pixel jitter without masking real regressions. Tighten later if
    // baselines stabilize across runners.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/visual\.spec\.ts/, /a11y(-[\w-]+)?\.spec\.ts/],
    },
    // E171/E211 — VRT project. Same browser as chromium, but isolated so the
    // visual sweep can be run via `pnpm test:e2e --project=visual` and updated
    // via `pnpm test:e2e --project=visual --update-snapshots`.
    {
      name: "visual",
      // E211 — commit the 336-cell baselines under e2e/__snapshots__/ (a flat
      // dir keyed by the per-cell snapshot name) rather than the default
      // <spec>-snapshots/ sibling dir.
      snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",
      use: {
        ...devices["Desktop Chrome"],
        // E211 — color-scheme now follows the THEME under test (dark vs light is
        // a function of the theme, applied via setThemeAndPreset), not a
        // project-global lock. The `colorScheme: "dark"` pin was removed here.
        //
        // prefers-reduced-motion freezes CSS animations during VRT capture so a
        // mid-spinner frame doesn't diff against a stationary one. The
        // maxDiffPixelRatio: 0.01 tolerance lives in `expect.toHaveScreenshot`.
        reducedMotion: "reduce",
      },
      testMatch: /visual\.spec\.ts/,
    },
    // E177 + E212 — A11y project. Now runs the FULL 6 themes × 2 presets =
    // 12-cell matrix across all 14 pages (a11y.spec.ts) + the Modal/Toast
    // primitive scans (a11y-primitives.spec.ts), proving WCAG 2.1 AA is
    // theme-and-preset-invariant. The axe-blind keyboard/focus/announcement
    // checks (a11y-interaction.spec.ts) run a single theme-invariant default
    // cell. The `testMatch` regex picks up all three:
    //   a11y.spec.ts | a11y-primitives.spec.ts | a11y-interaction.spec.ts
    // Run via `pnpm test:e2e --project=a11y`. This executes against a LIVE
    // LOCAL dev-server (webServer auto-starts Vite on port 3100; the backend
    // is reused). CI is `workflow_dispatch`-only since 2026-05-20 — the matrix
    // is NOT re-armed on every push (owner decision); it runs in hands-on
    // local sessions, same lane as the E211 VRT matrix.
    {
      name: "a11y",
      use: {
        ...devices["Desktop Chrome"],
        // Match VRT discipline so a11y + visual snapshots tell the same
        // story under animation suppression.
        reducedMotion: "reduce",
      },
      testMatch: /a11y(-[\w-]+)?\.spec\.ts/,
    },
  ],
  webServer: [
    // Backend: auto-start in CI or when E2E_BACKEND=1, otherwise reuse existing
    ...(startBackend
      ? [
          {
            command:
              "cd ../server && uv run alembic upgrade head && uv run uvicorn app.main:app --port 8080",
            url: "http://localhost:8080/health",
            reuseExistingServer: false,
            timeout: 60_000,
          },
        ]
      : []),
    {
      command: `pnpm vite --port ${E2E_PORT} --strictPort`,
      url: `http://localhost:${E2E_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 30_000,
    },
  ],
});
