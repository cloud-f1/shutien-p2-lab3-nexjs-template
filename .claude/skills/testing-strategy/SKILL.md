---
name: testing-strategy
description: >-
  The test-pyramid strategy and hard-won testing traps for this Next.js SaaS template (Next.js 16 +
  Drizzle + Auth.js v5). Use whenever you ADD or CHANGE tests, add a Server Action, wire a loader
  to a pure function, write an e2e/integration test, debug a "green but broken" feature, or decide
  "does this need a test and which layer?". Encodes: the pyramid shape + "few but precise" rule,
  the throwaway-DB integration harness pattern, the orphan-tested-function trap (tested but never
  wired), and the conditional-skip flaky-e2e trap. Read this before reaching for a new test so you
  pick the right layer and don't re-introduce a silent no-op.
---

# Next.js SaaS Template — Testing Strategy & Traps

Working docs (keep in sync when you change the suite): `docs/dev-guide/testing.md` (the pyramid +
layer guidance) and `docs/qa/` (human-judgment layer). This skill is the durable "how we test
here" — the docs are the live state.

## 1. The shape we want — pyramid, NOT hourglass

Target shape: **a large unit base · a thin but real integration middle · a focused e2e top**.
The bottom should be huge and trustworthy; the middle is **thin but real** (zero integration tests
is the bug, not thin integration tests).

- **Unit ≥ 70% is a floor, not a target.** A high unit ratio is NOT the goal; the goal is that
  *every layer that can silently break has at least one test watching it*.
- Pure functions prove **the algorithm is right**. They do NOT prove **the wiring is right** —
  that the loader calls the right function, that the Server Action's guard/audit/revalidate actually
  fire, that the UI renders the data. The integration layer is the net for "parts correct, assembly wrong".

## 2. "Few but precise" — the rule for growing the middle

Do NOT chase integration-layer volume. Grow it by **regression**:

- **Every new Server Action ships with ≥1 integration test** (real DB: writes the row, denies
  the wrong role, fires revalidation).
- **Every new wiring (loader → pure fn, or pure fn → UI) ships with ≥1 component or e2e assertion.**
- Each new test should lock **one** currently-zero-coverage real risk. If you can't name the risk it
  locks, don't add it.

## 3. The integration harness pattern (the unlock for the middle)

Pattern lives in `next-app/test/int/harness.ts` + a separate Vitest config, run via `pnpm test:int`.
If `test/int/` does not yet exist in this repo, describe the pattern and create it before adding
integration tests:

- Admin-connect to the `postgres` maintenance DB → `CREATE DATABASE saas_int_test_<pid>` →
  run `drizzle-kit migrate` against it → run the action → `DROP DATABASE` at teardown.
- **Critical ordering:** `setupTestDb()` sets `process.env.DATABASE_URL` to the throwaway DB
  **before** any `@/lib/db` (or any action importing it) loads. The `db` singleton reads
  `DATABASE_URL` at first import, so integration tests **must `await import()` the action AFTER
  `setupTestDb()`** — never a top-level static import of an action/db module.
- Only `@/lib/auth` and `next/cache` are mocked; everything else is the real pipeline
  (`auth() → getLiveRole(DB) → can(role, flag) → handler → revalidate`).
- Assertions read rows with a **separate** raw `postgres-js` client so you verify exactly what the
  action wrote, independent of its own `db` singleton.
- **Never point integration/e2e mutating tests at the dev DB.** Always use the throwaway DB.
- `afterEach` → truncate domain tables for isolation between tests.

### Example — items domain integration test

```ts
// next-app/test/int/items.int.test.ts
import { describe, it, expect, afterEach } from "vitest"
import { setupTestDb, teardownTestDb, truncateDomain, rawClient } from "./harness"

describe("createItem action", () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>

  beforeAll(async () => { db = await setupTestDb() })
  afterAll(async () => { await teardownTestDb(db) })
  afterEach(async () => { await truncateDomain(db, ["items"]) })

  it("admin can create an item and it appears in the DB", async () => {
    // Dynamic import AFTER setupTestDb — never top-level
    const { createItem } = await import("@/app/(dashboard)/dashboard/items/actions")
    const result = await createItem({ name: "Test Widget", description: "desc" })
    expect(result.success).toBe(true)

    const rows = await rawClient(db).select().from("items")
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe("Test Widget")
  })

  it("viewer cannot create an item (RBAC)", async () => {
    // Swap the auth mock to return viewer role
    vi.mocked(auth).mockResolvedValueOnce(makeSession("viewer"))
    const { createItem } = await import("@/app/(dashboard)/dashboard/items/actions")
    const result = await createItem({ name: "Blocked" })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/permission/i)
  })
})
```

## 4. Trap: the orphan-tested function (tested but never wired)

The canonical template trap: a pure utility has full unit tests and stays green for months — but
**nothing in production ever calls it**, so the feature silently does not exist.

**Template example:** An `exportItems` helper in `lib/items-utils.ts` has 100% unit coverage
proving the CSV serialization is correct. But the export Server Action in
`app/(dashboard)/dashboard/items/actions.ts` was never updated to call `exportItems` — it still
returns an empty response. Unit green, feature broken.

Guards:
- Add `pnpm check:orphans` (`scripts/check-orphan-exports.mjs`): flags `lib/` exports that
  have tests but **zero production callers**. Triage each — real missing wiring (fix it) vs.
  intentional public/dynamic API (allowlist in the script).
- When you add a pure function, in the SAME change add the call site **and** a test that exercises
  it *through* the wiring (component renders it, or integration test calls the action that uses it).

## 5. Trap: the conditional-skip flaky e2e (a "passing" test asserting nothing)

A test that uses `test.skip(condition, …)` — if the condition triggers, it silently skips, i.e.
stays green while testing nothing. This is the orphan-function trap in e2e form.

**Template example:** A TOTP e2e test skips when 2FA is not enabled for the seed account:

```ts
// WRONG — silently passes when 2FA isn't set up
test.skip(!user.totpEnabled, "2FA not enabled, skipping")

// RIGHT — fail loudly if the fixture expectation is wrong
if (!user.totpEnabled) throw new Error("Seed user must have TOTP enabled for this test")
```

Rules:
- E2e tests that depend on seed state should be **unconditional** — the seed is deterministic.
  If a test depends on a specific fixture (e.g. a billing plan, a specific API key), document
  which seed record it uses so a future seed editor knows the contract.
- Prefer "fail loudly if the fixture regresses" over "skip if absent".
- E2e that would mutate a persistent seed account (e.g. password reset, 2FA disable) should
  test the **UI gate** non-destructively and leave the destructive behavior to an integration test.

## 6. Trap: integration harness ordering (dynamic import after DB URL is set)

The `db` singleton in `@/lib/db.ts` reads `DATABASE_URL` **at module load time**. If you
static-import an action at the top of the integration test file, the import resolves before
`setupTestDb()` sets the throwaway DB URL — the action silently points at the dev DB.

**Wrong:**
```ts
import { createItem } from "@/app/(dashboard)/dashboard/items/actions" // ← resolves dev DB URL
// ...
beforeAll(async () => { await setupTestDb() }) // too late — db already initialized
```

**Correct:**
```ts
beforeAll(async () => { await setupTestDb() }) // sets DATABASE_URL first

it("...", async () => {
  const { createItem } = await import("@/app/.../actions") // ← dynamic import after URL set
})
```

## 7. Which layer? (decision)

| You're testing… | Layer | Where |
|---|---|---|
| A pure algorithm (Zod schema, hash fn, date util, format helper) | unit | `lib/*.test.ts`, `lib/validations/*` |
| A component renders derived state (disabled button, badge color) | component (jsdom) | `*.test.tsx` + Testing Library |
| A Server Action's DB side-effect + RBAC | integration | `test/int/*.int.test.ts` (`pnpm test:int`) |
| A multi-step user journey across pages | e2e | `e2e/*.spec.ts` (`pnpm test:e2e`) |
| Color/visual, copy, RWD/dark, concurrency feel | **manual** | `docs/qa/manual-test-plan/` |

Automation proves "didn't break"; the manual plan confirms "fit for use". A new feature PR should
add the matching automated entry; manual cases cover only what automation structurally can't.

## 8. Keep it from rotting

`pnpm test:int` and `pnpm check:orphans` run **outside** the default gate today — wire them into
`scripts/pre-merge-check.sh` / CI so the middle layer and the orphan guard can't silently bit-rot.

Related: `nextjs-saas-patterns` (stack gotchas, Auth.js JWT session trap), `docs/dev-guide/testing.md`
(layer commands + coverage gate).
