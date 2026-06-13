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
      // Focus coverage on the pure, testable logic layers.
      include: ["lib/validations/**", "lib/is-admin.ts", "actions/**"],
      exclude: ["**/*.test.ts", "e2e/**"],
    },
  },
})
