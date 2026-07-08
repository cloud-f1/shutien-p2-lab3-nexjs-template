/**
 * harness.ts — integration-test harness against a REAL, throwaway Postgres DB.
 *
 * Pattern (mirrors drizzle/test-migrate.ts):
 *   admin connection to the `postgres` maintenance DB
 *   → CREATE DATABASE saas_int_test_<pid>
 *   → `drizzle-kit migrate` with DATABASE_URL pointed at it
 *   → run the Server Action under test against it
 *   → DROP DATABASE at teardown.
 *
 * CRITICAL ordering trap: `setupTestDb()` sets `process.env.DATABASE_URL` to the
 * throwaway DB *before* any `@/lib/db` (or any action importing it) is loaded.
 * The `db` singleton in lib/db.ts reads DATABASE_URL at module-load time and
 * caches it on globalThis — so every int test file MUST call `setupTestDb()` in
 * `beforeAll` and only THEN `await import()` the action/module under test. A
 * top-level `import { createItem } from "@/actions/items"` at the head of a test
 * file resolves before beforeAll ever runs and silently binds to the dev DB.
 *
 * Reachability: use `isPostgresReachable()` at the top of each *.int.test.ts
 * file (before any `describe`) to skip gracefully — with a clear console
 * message — when no Postgres is available (e.g. `docker compose up -d postgres`
 * was never run), instead of hard-failing the whole suite.
 */
import { execFileSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import postgres from "postgres"

// next-app root (this file is at next-app/test/int/harness.ts).
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

const BASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://saas_user:saas_pass@localhost:5432/saas_dev"

/** Swap the database name in a connection URL, preserving host/port/creds/query. */
function withDatabase(url: string, dbName: string): string {
  const u = new URL(url)
  u.pathname = `/${dbName}`
  return u.toString()
}

const ADMIN_URL = withDatabase(BASE_URL, "postgres")
const TEST_DB = `saas_int_test_${process.pid}`
const TEST_URL = withDatabase(BASE_URL, TEST_DB)

export interface TestDb {
  url: string
  /** Raw postgres-js client for direct row reads/writes in setup/assert. */
  sql: ReturnType<typeof postgres>
}

let active: TestDb | null = null

/**
 * Quick reachability probe (short timeout, no side effects). Call this at the
 * top of an int test file — BEFORE any `describe` — and skip the whole suite
 * (via `describe.skipIf`) with a console message when it resolves `false`,
 * rather than hard-failing when no Postgres/docker-compose stack is running.
 */
export async function isPostgresReachable(): Promise<boolean> {
  let admin: ReturnType<typeof postgres> | null = null
  try {
    admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {}, connect_timeout: 3 })
    await admin`SELECT 1`
    return true
  } catch {
    return false
  } finally {
    if (admin) await admin.end({ timeout: 2 }).catch(() => {})
  }
}

/**
 * Create + migrate the throwaway DB and point DATABASE_URL at it. Call this in a
 * `beforeAll` BEFORE any dynamic import of an action / @/lib/db.
 */
export async function setupTestDb(): Promise<TestDb> {
  if (active) return active

  let admin: ReturnType<typeof postgres>
  try {
    admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {}, connect_timeout: 5 })
    await admin`SELECT 1`
  } catch (err) {
    throw new Error(`no Postgres reachable for integration tests — ${(err as Error).message}`)
  }

  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}" WITH (FORCE)`)
    await admin.unsafe(`CREATE DATABASE "${TEST_DB}"`)

    execFileSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
      stdio: "inherit",
      cwd: APP_DIR,
      env: { ...process.env, DATABASE_URL: TEST_URL },
    })
  } finally {
    await admin.end({ timeout: 5 })
  }

  // CRITICAL: set DATABASE_URL so lib/db.ts's singleton connects to the throwaway
  // DB on first (dynamic) import. NODE_ENV is "test" under vitest, so lib/db.ts
  // caches the singleton on globalThis — fine; we never connect to saas_dev.
  process.env.DATABASE_URL = TEST_URL

  const sql = postgres(TEST_URL, { max: 1, onnotice: () => {}, connect_timeout: 5 })
  active = { url: TEST_URL, sql }
  return active
}

/** Drop the throwaway DB. Call in `afterAll`. */
export async function teardownTestDb(): Promise<void> {
  if (!active) return
  const { sql } = active
  await sql.end({ timeout: 5 }).catch(() => {})
  active = null

  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {}, connect_timeout: 5 })
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}" WITH (FORCE)`)
  } catch {
    // best-effort
  } finally {
    await admin.end({ timeout: 5 })
  }
}

function requireDb(): TestDb {
  if (!active) throw new Error("setupTestDb() not called — no active test DB")
  return active
}

// ---------------------------------------------------------------------------
// Seed + read helpers (raw SQL via postgres-js — independent of the action's
// own `db` singleton, so assertions read exactly what the action wrote).
// ---------------------------------------------------------------------------

export interface SeedUserInput {
  email: string
  role?: "admin" | "editor" | "viewer"
  name?: string
  passwordHash?: string | null
}

/** Insert a user row; returns the generated uuid id. */
export async function seedUser(input: SeedUserInput): Promise<{ id: string; email: string }> {
  const { sql } = requireDb()
  const role = input.role ?? "viewer"
  const name = input.name ?? input.email
  const rows = await sql<{ id: string }[]>`
    INSERT INTO users (email, name, role, password_hash)
    VALUES (${input.email}, ${name}, ${role}, ${input.passwordHash ?? null})
    RETURNING id
  `
  return { id: rows[0].id, email: input.email }
}

/** Read a single user row by email. */
export async function readUserByEmail(
  email: string,
): Promise<{ id: string; role: string } | null> {
  const { sql } = requireDb()
  const rows = await sql<{ id: string; role: string }[]>`
    SELECT id, role FROM users WHERE email = ${email} LIMIT 1
  `
  return rows.length ? rows[0] : null
}

/** Read a single user's stored password hash by id (null for OAuth-only rows). */
export async function readUserPasswordHash(userId: string): Promise<string | null> {
  const { sql } = requireDb()
  const rows = await sql<{ password_hash: string | null }[]>`
    SELECT password_hash FROM users WHERE id = ${userId} LIMIT 1
  `
  return rows.length ? rows[0].password_hash : null
}

/** Read every item row owned by a user. */
export async function readItemsByUser(
  userId: string,
): Promise<{ id: string; title: string }[]> {
  const { sql } = requireDb()
  const rows = await sql<{ id: string; title: string }[]>`
    SELECT id, title FROM items WHERE user_id = ${userId} ORDER BY created_at
  `
  return rows
}

/** Count all item rows (across every user) — used to assert "nothing was written". */
export async function countItems(): Promise<number> {
  const { sql } = requireDb()
  const rows = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM items`
  return rows[0].n
}

/** Read usage_events rows for a user, optionally filtered by metric. */
export async function readUsageEvents(
  userId: string,
  metric?: string,
): Promise<{ metric: string; delta: number }[]> {
  const { sql } = requireDb()
  const rows = metric
    ? await sql<{ metric: string; delta: number }[]>`
        SELECT metric, delta FROM usage_events WHERE user_id = ${userId} AND metric = ${metric}
      `
    : await sql<{ metric: string; delta: number }[]>`
        SELECT metric, delta FROM usage_events WHERE user_id = ${userId}
      `
  return rows
}

/** TRUNCATE the given tables between tests for isolation — pass the ones a test touches. */
export async function truncateDomain(tables: string[]): Promise<void> {
  const { sql } = requireDb()
  const list = tables.map((t) => `"${t}"`).join(", ")
  await sql.unsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}
