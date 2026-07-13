/**
 * test-migrate.ts — verify migrations apply cleanly on a FRESH, EMPTY database.
 *
 * Why: smoke.sh's `db:migrate` step tolerates an already-migrated dev DB
 * ("already exists" → SKIP), so a migration that's broken *from scratch* would
 * slip through. This spins up a brand-new throwaway database, runs
 * `drizzle-kit migrate` against only it, asserts every expected table exists,
 * then drops it — leaving the dev DB untouched.
 *
 * Uses postgres-js (already a dependency) instead of `psql` so it runs anywhere
 * Node + the deps are present (the host often has no psql, only the container).
 *
 * Exit: 0 = clean apply, or SKIP (no Postgres reachable). 1 = migrate failed
 * or an expected table is missing on a fresh DB.
 *
 * Run:  pnpm db:test-migrate
 */
import { execFileSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import postgres from "postgres"

// next-app root (this file is at next-app/drizzle/test-migrate.ts) — so the
// migrate subprocess runs in the right package regardless of the caller's cwd.
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const BASE_URL = process.env.DATABASE_URL ?? "postgresql://saas_user:saas_pass@localhost:5432/saas_dev"

/** Swap the database name in a connection URL, preserving host/port/creds/query. */
function withDatabase(url: string, dbName: string): string {
  const u = new URL(url)
  u.pathname = `/${dbName}`
  return u.toString()
}

const ADMIN_URL = withDatabase(BASE_URL, "postgres") // maintenance DB for CREATE/DROP
const TEST_DB = `saas_migrate_test_${process.pid}`
const TEST_URL = withDatabase(BASE_URL, TEST_DB)

// Every `public` table a from-scratch migration must produce. (Drizzle's own
// `__drizzle_migrations` tracker lives in the separate `drizzle` schema and is
// asserted independently below.)
const EXPECTED = [
  "users",
  "accounts",
  "sessions",
  "verification_tokens",
  "email_verification_tokens",
  "password_reset_tokens",
  "items",
  "plans",
  "subscriptions",
  "payment_events",
  "usage_events",
  "api_keys",
  "webhooks",
  "webhook_deliveries",
  "audit_log",
  "invitations",
  "notifications",
  "products",
  "orders",
  "sales_pages",
  "sales_page_events",
]

async function main(): Promise<void> {
  let admin: ReturnType<typeof postgres>
  try {
    admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {}, connect_timeout: 5 })
    await admin`SELECT 1`
  } catch (err) {
    console.log(`⏭ SKIP: no Postgres reachable — ${(err as Error).message}`)
    process.exit(0)
  }

  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}" WITH (FORCE)`)
    await admin.unsafe(`CREATE DATABASE "${TEST_DB}"`)
    console.log(`▶ created empty test DB: ${TEST_DB}`)

    console.log("▶ running drizzle-kit migrate on the fresh DB")
    execFileSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
      stdio: "inherit",
      cwd: APP_DIR,
      env: { ...process.env, DATABASE_URL: TEST_URL },
    })

    console.log("▶ asserting expected tables exist")
    const sql = postgres(TEST_URL, { max: 1, onnotice: () => {}, connect_timeout: 5 })
    try {
      const rows = await sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      `
      const present = new Set(rows.map((r) => r.table_name))
      const missing = EXPECTED.filter((t) => !present.has(t))
      if (missing.length > 0) {
        console.error(`✖ tables missing after a fresh migrate: ${missing.join(", ")}`)
        process.exitCode = 1
        return
      }

      // Confirm Drizzle actually recorded the migrations (tracker in `drizzle` schema).
      const [{ tracked }] = await sql<{ tracked: number }[]>`
        SELECT count(*)::int AS tracked FROM drizzle.__drizzle_migrations
      `
      if (!tracked || tracked < 1) {
        console.error("✖ drizzle.__drizzle_migrations is empty — migrations were not tracked")
        process.exitCode = 1
        return
      }

      console.log(
        `✅ migrations apply cleanly on a fresh DB — ${EXPECTED.length} tables present, ${tracked} migration(s) tracked`,
      )
    } finally {
      await sql.end({ timeout: 5 })
    }
  } catch (err) {
    console.error(`✖ migration failed on a fresh, empty database: ${(err as Error).message}`)
    process.exitCode = 1
  } finally {
    try {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}" WITH (FORCE)`)
    } catch {
      // best-effort cleanup
    }
    await admin.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error("✖ migration test crashed:", err)
  process.exit(1)
})
