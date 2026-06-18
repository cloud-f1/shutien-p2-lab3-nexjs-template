import { defineConfig } from "vitest/config"

export default defineConfig({
  // Vitest 4 resolves tsconfig `paths` (the @/* alias) natively.
  resolve: { tsconfigPaths: true },
  test: {
    // Unit tests only — e2e lives in e2e/ and runs via Playwright.
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Scope coverage to the pure, db-free logic that unit tests actually
      // exercise. Server Actions, route handlers, and lib modules that import
      // `@/lib/db` throw at import without DATABASE_URL, so they are covered by
      // Playwright e2e — counting them here only distorts the denominator.
      include: [
        "lib/validations/**",
        "lib/is-admin.ts",
        "lib/api-keys-utils.ts",
        "lib/webhooks-utils.ts",
        "lib/team-utils.ts",
        "lib/notifications-utils.ts",
        "lib/admin-utils.ts",
        "lib/items-utils.ts",
        "lib/user-utils.ts",
        "lib/registry/validate-manifest.ts",
        "lib/billing/provider.ts",
        "lib/billing/billing-utils.ts",
        "lib/billing/resolver.ts",
        "lib/billing/providers/**",
        "lib/security-headers.ts",
      ],
      exclude: ["**/*.test.ts", "e2e/**"],
    },
  },
})
