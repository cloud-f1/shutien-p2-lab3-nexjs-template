import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  // VRT tolerance: absorb sub-pixel font-rendering diffs; disable animations so
  // screenshots are deterministic (the Cobalt FX also self-disable under
  // reducedMotion="reduce", set on the vrt project below).
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" },
  },
  projects: [
    {
      // Functional e2e (fast, deterministic) — excludes the screenshot VRT.
      name: "chromium",
      testIgnore: ["**/vrt/**"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Visual-regression: design-fidelity screenshot diffing (opt-in).
      // Baselines are platform-suffixed by Playwright; regenerate per-env with
      // `pnpm test:vrt:update`. Run via `pnpm test:vrt` / `scripts/smoke.sh --vrt`.
      name: "vrt",
      testMatch: ["**/vrt/**/*.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Start the dev server automatically when running tests locally
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        // Cold Next 16 + turbopack dev boot can exceed the 60s default.
        timeout: 120_000,
        env: {
          DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://saas_user:saas_pass@localhost:5432/saas_dev",
          AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-test-secret",
          // Surface the seeded quick-login buttons for e2e. The demo-login gate
          // is now STRICT (only NEXT_PUBLIC_ENABLE_DEMO_LOGIN==="true"), so this
          // keeps the demo path available under test. (loginAs() fills the form
          // directly, but this guarantees parity with the dev/Docker stack.)
          NEXT_PUBLIC_ENABLE_DEMO_LOGIN:
            process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN ?? "true",
        },
      },
})
