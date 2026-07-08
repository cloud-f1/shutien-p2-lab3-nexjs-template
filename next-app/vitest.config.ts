import { defineConfig } from "vitest/config"

export default defineConfig({
  // Vitest 4 resolves tsconfig `paths` (the @/* alias) natively.
  resolve: { tsconfigPaths: true },
  test: {
    // Unit + component tests — e2e lives in e2e/ and runs via Playwright;
    // integration tests (test/int/**/*.int.test.ts, real throwaway-DB Server
    // Action tests) need Postgres and run separately via `pnpm test:int`
    // (vitest.int.config.ts) — never as part of the default `pnpm test`.
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", ".next/**", "test/int/**"],
    // Default node env (fast) for the pure-logic suite; component tests
    // (test/component/**/*.test.tsx) opt into jsdom per-file via the
    // `// @vitest-environment jsdom` pragma on the first line of the file.
    environment: "node",
    setupFiles: ["./test/setup.ts"],
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
        "lib/rate-limit.ts",
        "lib/totp-utils.ts",
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
