/**
 * usage.int.test.ts — recordUsage (actions/usage.ts) writing real usage_events
 * rows, then getCurrentMonthUsage (lib/db/queries/usage.ts) reading the SQL-side
 * aggregate back — the billing/usage metering write→read round trip.
 *
 * This is the wiring the unit layer cannot see: usage-utils.test.ts proves
 * `aggregateUsage`/`getUsagePeriod` are correct in isolation, but nothing
 * unit-level proves recordUsage actually persists a row that
 * getCurrentMonthUsage's Postgres `SUM(...)` picks back up inside the current
 * calendar-month window. Only a real DB round trip catches that.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { isPostgresReachable, readUsageEvents, seedUser, setupTestDb, teardownTestDb, truncateDomain } from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) {
  console.warn(
    "⏭ SKIP next-app/test/int/usage.int.test.ts — no reachable Postgres. " +
      "Start it with `docker compose up -d postgres` (repo root) or set TEST_DATABASE_URL, then re-run `pnpm test:int`.",
  )
}

// Mutable actor id flipped per-test; the mock reads it lazily.
let actorId: string | null = null
vi.mock("@/lib/auth", () => ({
  auth: async () => (actorId ? { user: { id: actorId } } : null),
}))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

describe.skipIf(!reachable)("recordUsage → getCurrentMonthUsage (usage metering round trip)", () => {
  // Loaded AFTER setupTestDb() sets DATABASE_URL — never a top-level static
  // import of an action/query in an int test file (see harness.ts).
  let recordUsage: typeof import("@/actions/usage").recordUsage
  let getCurrentMonthUsage: typeof import("@/lib/db/queries/usage").getCurrentMonthUsage

  beforeAll(async () => {
    await setupTestDb()
    ;({ recordUsage } = await import("@/actions/usage"))
    ;({ getCurrentMonthUsage } = await import("@/lib/db/queries/usage"))
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    await truncateDomain(["usage_events", "users"])
  })

  it("explicit userId (Route Handler style, no session): writes a row and the month aggregate sums it", async () => {
    const user = await seedUser({ email: "api-owner@int.test", role: "viewer" })

    const result = await recordUsage("api_request", 3, user.id)
    expect(result).toEqual({ success: true })

    const rows = await readUsageEvents(user.id, "api_request")
    expect(rows).toHaveLength(1)
    expect(rows[0].delta).toBe(3)

    expect(await getCurrentMonthUsage(user.id, "api_request")).toBe(3)
  })

  it("multiple events for the same metric accumulate; other metrics are not mixed in", async () => {
    const user = await seedUser({ email: "aggregate@int.test", role: "viewer" })

    await recordUsage("api_request", 2, user.id)
    await recordUsage("api_request", 5, user.id)
    await recordUsage("tokens", 100, user.id) // different metric — must not leak into api_request's sum

    expect(await getCurrentMonthUsage(user.id, "api_request")).toBe(7)
    expect(await getCurrentMonthUsage(user.id, "tokens")).toBe(100)
    // a metric with zero events for this user reads back 0, not an error
    expect(await getCurrentMonthUsage(user.id, "seats")).toBe(0)
  })

  it("session context (no explicit userId): attributes the event to the signed-in user", async () => {
    const user = await seedUser({ email: "session-owner@int.test", role: "editor" })
    actorId = user.id

    const result = await recordUsage("api_request")
    expect(result).toEqual({ success: true })

    const rows = await readUsageEvents(user.id, "api_request")
    expect(rows).toHaveLength(1)
    expect(rows[0].delta).toBe(1) // default delta
  })

  it("blank metric is rejected before any DB write", async () => {
    const user = await seedUser({ email: "blank-metric@int.test", role: "viewer" })

    const result = await recordUsage("   ", 1, user.id)
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
    expect(await readUsageEvents(user.id)).toHaveLength(0)
  })
})
