/**
 * e2e database setup — gives Playwright its OWN database instead of sharing the
 * dev one.
 *
 * WHY THIS EXISTS
 * ---------------
 * `pnpm test:e2e` migrates and seeds whatever `DATABASE_URL` points at. For a long
 * time that defaulted to `saas_dev` — the same database `pnpm dev` and
 * `docker compose up` use. Two consequences, both observed in this repo:
 *
 *   1. Running e2e wiped/reshaped your own dev data.
 *   2. Parallel worktrees (the athena batch flow runs several at once) migrated the
 *      SAME database against DIFFERENT branch schemas. That is how `saas_dev` ended
 *      up with 17 applied migrations while every branch had only 15 `.sql` files —
 *      drift first noted in the Phase 77 orchestration log and never reconciled.
 *
 * A convention of "point e2e at saas_dev_e2e and drop the schema first" did emerge,
 * but it lived only in reviewers' heads and in hand-typed
 * `docker exec nextapp_postgres psql …` incantations. Anyone who did not know it hit
 * the dev database. This script makes the convention the default and the easy path.
 *
 * WHAT IT DOES
 *   DROP DATABASE (FORCE) → CREATE → drizzle-kit migrate → seed
 *
 * The drop is what makes seeding deterministic: `drizzle/seed.ts` short-circuits with
 * "Demo data already present — skipping enrichment" when rows exist, so a re-seed
 * onto a dirty database silently skips new fixtures and leaves specs failing for
 * reasons that have nothing to do with the code under test.
 *
 *   pnpm db:e2e-setup     # then: pnpm test:e2e
 */
import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

import postgres from "postgres"

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** Base connection — the server we create the e2e database ON. */
const BASE_URL =
  process.env.E2E_BASE_DATABASE_URL ??
  "postgresql://saas_user:saas_pass@localhost:5432/saas_dev"

const E2E_DB = process.env.E2E_DB_NAME ?? "saas_dev_e2e"
const ADMIN_URL = BASE_URL.replace(/\/[^/]*$/, "/postgres")
const E2E_URL = BASE_URL.replace(/\/[^/]*$/, `/${E2E_DB}`)

async function main() {
  if (E2E_DB === "saas_dev") {
    // Guard the exact mistake this script exists to prevent.
    throw new Error(
      "refusing to run: E2E_DB_NAME is 'saas_dev', the development database. " +
        "e2e must not share a database with dev — pick another name.",
    )
  }

  let admin: ReturnType<typeof postgres>
  try {
    admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {}, connect_timeout: 5 })
    await admin`SELECT 1`
  } catch (err) {
    throw new Error(
      `no Postgres reachable at ${ADMIN_URL} — is the container up? ` +
        `(docker compose up -d postgres) — ${(err as Error).message}`,
    )
  }

  try {
    console.log(`→ recreating ${E2E_DB} (drop + create)`)
    await admin.unsafe(`DROP DATABASE IF EXISTS "${E2E_DB}" WITH (FORCE)`)
    await admin.unsafe(`CREATE DATABASE "${E2E_DB}"`)
  } finally {
    await admin.end({ timeout: 5 })
  }

  const env = { ...process.env, DATABASE_URL: E2E_URL }
  console.log("→ drizzle-kit migrate")
  execFileSync("pnpm", ["exec", "drizzle-kit", "migrate"], { stdio: "inherit", cwd: APP_DIR, env })
  console.log("→ seed")
  execFileSync("pnpm", ["exec", "tsx", "drizzle/seed.ts"], { stdio: "inherit", cwd: APP_DIR, env })

  console.log(`\n✅ e2e database ready: ${E2E_URL}`)
  console.log("   run: pnpm test:e2e")
}

main().catch((err) => {
  console.error(`\n❌ e2e db setup failed: ${(err as Error).message}`)
  process.exit(1)
})
