/**
 * usage.int.test.ts — recordUsage (actions/usage.ts) and recordUsageFor
 * (lib/usage.ts) writing real usage_events rows, then getCurrentMonthUsage
 * (lib/db/queries/usage.ts) reading the SQL-side aggregate back — the
 * billing/usage metering write→read round trip.
 *
 * This is the wiring the unit layer cannot see: usage-utils.test.ts proves
 * `aggregateUsage`/`getUsagePeriod` are correct in isolation, but nothing
 * unit-level proves recordUsage/recordUsageFor actually persist a row that
 * getCurrentMonthUsage's Postgres `SUM(...)` picks back up inside the current
 * calendar-month window. Only a real DB round trip catches that.
 *
 * E346: `actions/usage.ts`'s `recordUsage` used to accept an optional
 * `userId` that bypassed its `requireAuth()` guard entirely — an
 * unauthenticated caller could forge usage rows for any user. The fix split
 * the write path: `recordUsageFor(userId, metric, delta)` in `lib/usage.ts`
 * is the internal, non-"use server" function for already-authorized
 * Route-Handler callers; `recordUsage(metric, delta)` in `actions/usage.ts`
 * is the public Server Action, which no longer accepts a userId at all — it
 * always resolves the owner from the session. The tests below cover both,
 * plus a regression test proving the forged-userId attack is now refused.
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
  let recordUsageFor: typeof import("@/lib/usage").recordUsageFor
  let getCurrentMonthUsage: typeof import("@/lib/db/queries/usage").getCurrentMonthUsage

  beforeAll(async () => {
    await setupTestDb()
    ;({ recordUsage } = await import("@/actions/usage"))
    ;({ recordUsageFor } = await import("@/lib/usage"))
    ;({ getCurrentMonthUsage } = await import("@/lib/db/queries/usage"))
  }, 120_000)

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    actorId = null
    await truncateDomain(["usage_events", "users"])
  })

  it("recordUsageFor (Route Handler style, already-authorized userId): writes a row and the month aggregate sums it", async () => {
    const user = await seedUser({ email: "api-owner@int.test", role: "viewer" })

    const result = await recordUsageFor(user.id, "api_request", 3)
    expect(result).toEqual({ success: true })

    const rows = await readUsageEvents(user.id, "api_request")
    expect(rows).toHaveLength(1)
    expect(rows[0].delta).toBe(3)

    expect(await getCurrentMonthUsage(user.id, "api_request")).toBe(3)
  })

  it("multiple events for the same metric accumulate; other metrics are not mixed in", async () => {
    const user = await seedUser({ email: "aggregate@int.test", role: "viewer" })

    await recordUsageFor(user.id, "api_request", 2)
    await recordUsageFor(user.id, "api_request", 5)
    await recordUsageFor(user.id, "tokens", 100) // different metric — must not leak into api_request's sum

    expect(await getCurrentMonthUsage(user.id, "api_request")).toBe(7)
    expect(await getCurrentMonthUsage(user.id, "tokens")).toBe(100)
    // a metric with zero events for this user reads back 0, not an error
    expect(await getCurrentMonthUsage(user.id, "seats")).toBe(0)
  })

  it("session context (recordUsage, the public action): attributes the event to the signed-in user", async () => {
    const user = await seedUser({ email: "session-owner@int.test", role: "editor" })
    actorId = user.id

    const result = await recordUsage("api_request")
    expect(result).toEqual({ success: true })

    const rows = await readUsageEvents(user.id, "api_request")
    expect(rows).toHaveLength(1)
    expect(rows[0].delta).toBe(1) // default delta
  })

  it("blank metric is rejected before any DB write (recordUsageFor)", async () => {
    const user = await seedUser({ email: "blank-metric@int.test", role: "viewer" })

    const result = await recordUsageFor(user.id, "   ", 1)
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
    expect(await readUsageEvents(user.id)).toHaveLength(0)
  })

  // ---------------------------------------------------------------------
  // E346 regression — the closed vulnerability.
  //
  // Before the fix, `recordUsage(metric, delta, userId)` skipped
  // `requireAuth()` entirely whenever a 3rd `userId` argument was present,
  // so an unauthenticated caller could forge usage rows for ANY user. The
  // fix removed the `userId` parameter from the public action's signature
  // — it is no longer even type-expressible. A Server Action is reachable
  // over the wire as a POST regardless of its TS signature though, so this
  // test simulates a stale/malicious client still sending a 3rd positional
  // argument to prove the *runtime* behavior is safe, not just the types.
  // ---------------------------------------------------------------------
  it("SECURITY (E346): unauthenticated caller cannot forge usage for another user via a forged 3rd arg", async () => {
    const victim = await seedUser({ email: "victim@int.test", role: "viewer" })
    actorId = null // no session — the attacker is not logged in

    // @ts-expect-error — recordUsage's signature no longer accepts a 3rd
    // (userId) argument; this simulates a client still POSTing one anyway.
    const result = await recordUsage("api_request", 1, victim.id)

    expect(result).toEqual({ success: false, error: "請先登入。" })
    // Zero rows written — neither to the victim nor anyone else.
    expect(await readUsageEvents(victim.id, "api_request")).toHaveLength(0)
  })
})
