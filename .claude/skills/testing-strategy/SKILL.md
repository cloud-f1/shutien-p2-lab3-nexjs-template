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

Pattern lives in `next-app/test/int/harness.ts` (E321) + `next-app/vitest.int.config.ts`, run via
`pnpm test:int`. Reference tests: `test/int/items.int.test.ts`, `test/int/rbac.int.test.ts`,
`test/int/usage.int.test.ts`. Every `*.int.test.ts` file calls `isPostgresReachable()` before its
`describe` block and `describe.skipIf`s the suite with a `console.warn` when no Postgres is
reachable — `pnpm test:int` exits 0 (skipped) rather than hard-failing when
`docker compose up -d postgres` hasn't been run.

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

The real reference test (`next-app/test/int/items.int.test.ts`), trimmed to the shape that
matters — see the actual file for the full ownership/validation cases and
`test/int/rbac.int.test.ts` for the RBAC-rejection variant:

```ts
// next-app/test/int/items.int.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { countItems, isPostgresReachable, readItemsByUser, seedUser, setupTestDb, teardownTestDb, truncateDomain } from "./harness"

const reachable = await isPostgresReachable()
if (!reachable) console.warn("⏭ SKIP — no reachable Postgres; run `docker compose up -d postgres`.")

let actorId: string | null = null
vi.mock("@/lib/auth", () => ({ auth: async () => (actorId ? { user: { id: actorId } } : null) }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

describe.skipIf(!reachable)("createItem / deleteItem (actions/items.ts)", () => {
  let items: typeof import("@/actions/items")

  beforeAll(async () => {
    await setupTestDb() // sets DATABASE_URL first
    items = await import("@/actions/items") // dynamic import AFTER — never top-level
  }, 120_000)

  afterAll(async () => { await teardownTestDb() })
  afterEach(async () => { actorId = null; await truncateDomain(["items", "users"]) })

  it("editor: create → the row exists in the DB, then delete removes it", async () => {
    const editor = await seedUser({ email: "editor@int.test", role: "editor" })
    actorId = editor.id

    const form = new FormData()
    form.set("title", "Integration Widget")
    expect(await items.createItem(null, form)).toBeNull() // null = success

    const rows = await readItemsByUser(editor.id)
    expect(rows).toHaveLength(1)
    expect(await items.deleteItem(rows[0].id)).toBeNull()
    expect(await countItems()).toBe(0)
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
import { createItem } from "@/actions/items" // ← resolves dev DB URL
// ...
beforeAll(async () => { await setupTestDb() }) // too late — db already initialized
```

**Correct:**
```ts
beforeAll(async () => { await setupTestDb() }) // sets DATABASE_URL first

it("...", async () => {
  const { createItem } = await import("@/actions/items") // ← dynamic import after URL set
})
```

## 6b. Doc↔code contract tests — a pyramid-base guard, not e2e (E341)

`next-app/lib/doc-contract.test.ts` is a plain **unit** test file (`lib/*.test.ts`, runs as
part of `pnpm test`) — it sits at the base of the pyramid, not near the top with e2e, even
though it's "checking documentation." What it actually tests is pure and synchronous:
sub-process a shell script and parse its output, import an exported constant, or read a
source file as text and regex out a value — then compare that value to a hardcoded literal
transcribed from a doc/skill. No browser, no DB, no server — same reason `lib/team-utils.test.ts`
is unit-tier, not integration.

Why NOT e2e: an e2e test proves a user-visible flow works end-to-end; a doc-contract test
proves a **number or enum agrees between two places that a type-checker can't connect** (code
constant vs prose). Different risk, different layer. Don't route "does this doc match the
code" checks through Playwright just because the check happens to mention a UI-rendered
value (e.g. status tones) — read the component source as text instead (see the file for the
`TONES` extraction pattern), the same way you'd unit-test any other pure transform.

This complements — does not replace — `/athena:audit` Step 6a's manual doc↔code drift scan:
the parts Step 6a covers that a test CAN pin become an entry here; the parts that are pure
prose (process descriptions, screenshots, example commands) stay manual. See
`docs/context/qa-patterns.md` § "doc↔code 契約測試" for the 判準 on when a constant is worth
adding.

## 7. Which layer? (decision)

| You're testing… | Layer | Where |
|---|---|---|
| A pure algorithm (Zod schema, hash fn, date util, format helper) | unit | `lib/*.test.ts`, `lib/validations/*` |
| A component renders derived state (disabled button, badge color) | component (jsdom) | `test/component/*.test.tsx` — first line `// @vitest-environment jsdom`, runs as part of `pnpm test` |
| A code constant vs. a doc/skill's restated prose value (§6b) | unit | `lib/doc-contract.test.ts` — runs as part of `pnpm test` |
| A Server Action's DB side-effect + RBAC | integration | `test/int/*.int.test.ts` (`pnpm test:int`) |
| A multi-step user journey across pages | e2e | `e2e/*.spec.ts` (`pnpm test:e2e`) |
| Color/visual, copy, RWD/dark, concurrency feel | **manual** | `docs/qa/manual-test-plan/` |

Automation proves "didn't break"; the manual plan confirms "fit for use". A new feature PR should
add the matching automated entry; manual cases cover only what automation structurally can't.

## 8. Keep it from rotting

`pnpm test:int` and `pnpm check:orphans` run **outside** the default gate today — wire them into
`scripts/pre-merge-check.sh` / CI so the middle layer and the orphan guard can't silently bit-rot.

## TDD principles

### The cycle: RED → GREEN → REFACTOR

1. **RED** — write a failing test that defines expected behavior.
2. **GREEN** — write the minimum code to make it pass.
3. **REFACTOR** — clean up without changing behavior, re-run tests.

Do NOT write implementation code before the test exists and fails. Coverage gate: unit
`cd next-app && pnpm test -- --coverage` (target 80%) | e2e `cd next-app && pnpm test:e2e`
(all scenarios must pass).

### Layer A — testing philosophy

**P1. Test behavior, not implementation.** Assert on HTTP status / return values / DB state —
not internal call counts.

```typescript
// DO — assert on behavior (return value of the real Server Action)
const result = await createItem(null, formData)
expect(result).toBeNull() // null = success

// DON'T — tests internal wiring, not behavior
expect(mockDb.insert).toHaveBeenCalledOnce() // ← tests implementation, not behavior
```

Litmus: if you refactor internals but output stays the same, does the test still pass?

**P2. Triangulation.** Use multiple cases to force general logic; prefer `it.each` /
`describe.each` in Vitest.

```typescript
it.each([
  ["valid@example.com", true],
  ["", false],
  ["no-at-sign", false],
])("validates email %s → %s", (email, valid) => {
  expect(validateEmail(email)).toBe(valid)
})
```

### Layer B — testable architecture

**P3. Humble object.** Keep framework glue thin; push logic into testable pure functions or
`lib/<domain>-utils.ts` modules (e.g. `lib/items-utils.ts`) — unit-test those directly rather
than testing business logic embedded in a Route Handler or Server Action body.

**P4. Dependency injection.** In Next.js, inject dependencies via function arguments (no DI
framework). Tests pass test doubles directly:

```typescript
// service.ts
export async function createUser(db: DrizzleDb, email: string) { ... }

// service.test.ts
const mockDb = { insert: vi.fn().mockResolvedValue([{ id: "1" }]) }
await createUser(mockDb as any, "test@example.com")
```

**P5. Wrappers.** Wrap third-party services behind your own interface so they're mockable —
e.g. `lib/billing/providers/stripe.ts` adapter, mocked with `vi.mock()`, instead of calling
`stripe.charges.create()` directly inside a Server Action.

### Layer C — boundary control

**P6. Contract tests.** Validate assumptions about external interfaces haven't drifted — e.g.
`satisfies z.ZodType<...>` on client Zod schemas, or an integration test asserting the actual
Drizzle row shape matches what the Server Action returns.

**P7. Effective mocking.** Mock at system boundaries only; never mock your own core logic.
`vi.mock("@/lib/db")` for the DB boundary in unit tests, Playwright `page.route()` for the
network boundary in e2e. Return realistic data matching actual Drizzle schema shapes. Don't
mock Server Actions themselves — test the underlying logic/DB behavior they drive (see the
integration harness in §3 for the real-DB version of this).

### Layer D — AI agent rules

**P8. Agent test guidelines**
1. Test public behavior via rendered output (component) or return value (Server Action/service function).
2. Never `expect(mock).toHaveBeenCalled()` on internal logic — assert DOM or return values instead.
3. Use `userEvent` (not `fireEvent`) for interaction tests.
4. Use Playwright for auth flows and full page interactions — Vitest for unit/component logic.
5. All tests are TypeScript: Vitest for unit/integration, Playwright for e2e. No other test runner.

**P9. Parametrize over duplication.** One `it.each`/`describe.each` for input variants, not five
near-identical `it()` blocks with one value changed.

**P10. Mock boundaries, not internals**

| Layer | Mock target | Tool |
|-------|------------|------|
| DB (unit) | `@/lib/db` module | `vi.mock("@/lib/db")` |
| External API | Third-party SDK modules | `vi.mock("stripe")` etc. |
| Network (e2e) | HTTP requests | Playwright `page.route()` |
| Time | Timers / dates | `vi.useFakeTimers()` |

Never mock: Next.js router internals, Auth.js session internals, Drizzle query builder internals.

### What to test / not to test

**Server logic**: happy path, auth guard (redirect/401), validation errors, not found, duplicate.
**Client components**: loading, success render, error render, user interactions, empty state.
**Never**: internal state, private methods, library internals, CSS class names, framework plumbing.

Related: `nextjs-saas-patterns` (stack gotchas, Auth.js JWT session trap), `docs/dev-guide/testing.md`
(layer commands + coverage gate).
