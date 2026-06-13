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
  projects: [
    {
      name: "chromium",
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
        },
      },
})
