import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// Integration tests — exercise real Server Actions against a throwaway Postgres
// DB (see test/int/harness.ts). Kept OUT of the default `pnpm test` run so the
// unit suite never requires a database. Run with `pnpm test:int`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` is a Next.js build-time guard with no runtime impl outside
      // the Next bundler — alias it to a harmless empty module so actions/lib that
      // import it load under plain vitest node.
      "server-only": fileURLToPath(new URL("./test/int/server-only-stub.ts", import.meta.url)),
      // next-auth's lib/env.js does a bare `import "next/server"`, which Node's
      // ESM resolver rejects outside the Next bundler ("Did you mean
      // next/server.js?"). Point it at the real file so an int test can import
      // @/lib/auth (E355 exercises the REAL authorize path against a real DB).
      "next/server": fileURLToPath(new URL("./node_modules/next/server.js", import.meta.url)),
    },
  },
  test: {
    include: ["test/int/**/*.int.test.ts"],
    environment: "node",
    server: {
      // Inline next-auth so Vite (not Node's raw ESM resolver) processes it and
      // the `next/server` alias above applies — otherwise importing @/lib/auth
      // dies on next-auth/lib/env.js's bare `import "next/server"`.
      deps: { inline: [/next-auth/] },
    },
    // Each int file creates/migrates its own throwaway DB keyed by process.pid;
    // run files in a single fork so they don't race on the same DB name.
    fileParallelism: false,
    // Migrations + bcrypt are not instant — give generous timeouts.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
