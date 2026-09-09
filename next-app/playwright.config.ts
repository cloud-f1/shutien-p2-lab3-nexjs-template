import { defineConfig, devices } from "@playwright/test"

/**
 * ONE base URL for the whole run — `use.baseURL` (what the specs hit) and
 * `webServer.url` (what Playwright probes/starts) must never disagree, or the
 * suite reuses a server on :3000 while testing something else entirely.
 */
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3000"
const BASE_PORT = (() => {
  try {
    return new URL(BASE_URL).port
  } catch {
    return ""
  }
})()

export default defineConfig({
  testDir: "./e2e",
  // E357 — refuse to run against a server that is not this checkout. Aborts the
  // whole run with one actionable message instead of producing a suite-full of
  // failures (or a false green) against another app squatting on the port.
  globalSetup: "./e2e/global-setup.ts",
  // E373 — clears 2FA/lockout residue from the seed accounts after every run,
  // unconditionally. two-factor.spec.ts's own afterAll cannot be relied on:
  // it bails when an earlier test in that file failed, which is how three
  // Phase 89 runs were poisoned.
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
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
        // Follow PLAYWRIGHT_BASE_URL: reuse the warm server you started
        // yourself on that port (the fast loop-protocol path), and if nothing
        // is there, boot ours on the SAME port instead of blindly on :3000.
        url: BASE_URL,
        reuseExistingServer: true,
        // Cold Next 16 + turbopack dev boot can exceed the 60s default.
        timeout: 120_000,
        env: {
          // Only set when the base URL names an explicit port; `next dev`
          // defaults to 3000, which is what the default BASE_URL means anyway.
          ...(BASE_PORT ? { PORT: BASE_PORT } : {}),
          // e2e gets its OWN database — NEVER saas_dev. Sharing the dev DB meant an
          // e2e run reshaped your dev data, and parallel worktrees migrated one
          // database against different branch schemas (that is how saas_dev drifted
          // to 17 applied migrations against 15 repo .sql files). Provision it with
          // `pnpm db:e2e-setup`; override the whole URL with E2E_DATABASE_URL.
          DATABASE_URL:
            process.env.E2E_DATABASE_URL ??
            "postgresql://saas_user:saas_pass@localhost:5432/saas_dev_e2e",
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
