# Test Strategy — Pyramid Audit & Augmentation Plan

> Quantifies the current test pyramid, diagnoses its shape, and lists a small,
> precise list of augmentation targets. Companion: `manual-test-plan/` (the
> human-judgment layer automation structurally can't cover).
>
> Related: `.claude/skills/testing-strategy/SKILL.md` (the durable "how we test
> here" traps — harness ordering, orphan-tested functions, conditional-skip
> flaky e2e) and `docs/dev-guide/testing.md` (day-to-day commands).

## 1. Current quantification (2026-07-08, after E321 — middle layer landed)

All counts from a real run: `pnpm test` (unit + component), `pnpm test:int` (integration,
throwaway Postgres), `pnpm test:e2e` (Playwright, chromium project). VRT (`pnpm test:vrt`)
is tracked separately — it's a visual-regression net, not a pyramid layer.

| Layer | Files | Tests | % of automated suite | Status |
|---|---|---:|---:|---|
| **Unit** (pure functions + Zod validation) | 41 | 518 | ~86.5% | ✅ thick, high-quality base |
| **Component** (jsdom + Testing Library) | 2 | 5 | ~0.8% | 🟡 environment ready, deliberately thin (locks new-feature wiring) |
| **Integration** (DB-backed Server Actions, throwaway DB) | 3 | 10 | ~1.7% | 🟡 middle layer established, deliberately few-but-precise |
| **E2E** (Playwright, chromium) | 6 specs | 66 | ~11.0% | ✅ full user journeys + RBAC + billing + 2FA |
| **Total (automated, excl. VRT)** | 52 | **599** | 100% | — |
| VRT (visual regression, separate concern) | 1 spec | 5 | — | ✅ tracked outside the pyramid |

**Shape: pyramid, not hourglass — and the middle is no longer zero.** Before E321 the
suite was unit + e2e only: a pure function could be 100% unit-tested while the Server
Action that was supposed to call it never did (the *orphan-tested-function trap*, see
the testing-strategy skill §4), and no automated test proved a Dialog form's `onSuccess`
wiring or a `<DataTable>` filter actually worked end-to-end in the DOM. E321 ships the
harness + reference tests that close that gap — deliberately **thin**, not exhaustive.

## 2. The 70% rule — how to read the ratios

"Unit ≥ 70%" is a **floor, not a target**. ~86.5% is not a problem to fix — a high unit
ratio is fine *as long as every layer that can silently break has at least one test
watching it*. Pure functions prove the algorithm is right; they do not prove:

- the Server Action's guard/DB-write/revalidate actually fire (→ **integration**)
- the component actually renders the derived state / calls the right callback (→ **component**)
- the multi-step user journey across pages actually works (→ **e2e**)

The middle two rows existing at all — even thin — is the fix. Growth from here is by
**regression**, not volume: every new Server Action ships with ≥1 integration test, every
new component wiring ships with ≥1 component or e2e assertion (testing-strategy skill §2).

## 3. Gaps (Loss) & a small, precise augmentation list

Principle: **few but precise** — each row locks one currently-zero-coverage real risk. Do
NOT treat this as a coverage checklist to exhaustively fill; treat it as the next
regression-driven additions when those surfaces change.

| # | Layer | What | Risk it locks | Status |
|---|---|---|---|---|
| T1 | Integration | `items.int.test.ts` — `createItem`→DB row→`deleteItem`, ownership-scoped delete, blank-title rejection | Items CRUD wiring (guard → DB → revalidate) | ✅ landed (E321) |
| T2 | Integration | `rbac.int.test.ts` — viewer blocked (`/dashboard` redirect), unauthenticated blocked (`/login`), admin let through | `requireEditor()`'s live-DB-role guard, not just the session snapshot | ✅ landed (E321) |
| T3 | Integration | `usage.int.test.ts` — `recordUsage` → real row → `getCurrentMonthUsage`'s SQL `SUM()` aggregate, multi-metric isolation | Usage-metering write→read round trip (E301's billing/usage foundation) | ✅ landed (E321) |
| T4 | Component | `item-form.test.tsx` — `onSuccess`/`{error}` wiring, client Zod validation blocks blank submit before the action is called | CRUD-modal contract (CLAUDE.md: actions return success, no redirect — the modal must close via `onSuccess`) | ✅ landed (E321) |
| T5 | Component | `data-table-filter.test.tsx` — global filter narrows rows + row count, empty-state on no match | `<DataTable>` is the **shared** list-view primitive (E273) — a regression here breaks every domain's list page's search box at once | ✅ landed (E321) |
| T6 | Integration | `POST /api/billing/reconcile` — a drifted subscription (mocked gateway response) gets its status/period-end repaired in the DB | The money-path drift-repair route only has pure-fn coverage (`reconcile-utils.test.ts`); nothing proves the route's DB write actually happens | 🔴 not yet covered |
| T7 | Integration | An API key Server Action (`actions/api-keys.ts` create/revoke) against the real DB | API-key issuance/revocation is a security-sensitive DB write with only unit coverage on the pure hashing/parsing helpers | 🔴 not yet covered |
| T8 | Component | Admin panel's `_role-selector.tsx` — changing a role calls the action with the new value, disabled for the signed-in admin's own row | Self-demotion guard is UI-enforced; no test watches the render/callback wiring | 🔴 not yet covered |
| T9 | Integration | `setUserRole`/admin user-management action — non-admin rejected, admin cannot demote self | Admin-panel RBAC mutation currently only has e2e coverage (slower, less precise on the DB assertion) | 🔴 not yet covered |

> T6–T9 are **candidates for the next regression-driven pass**, not a blocking backlog —
> per the Out of Scope note in E321, 100% middle-layer coverage is explicitly not the
> goal. Add the matching test in the SAME change that touches these surfaces next.

## 4. Running the integration layer (`pnpm test:int`)

Integration tests need a **real, reachable Postgres** — they spin up a throwaway
`saas_int_test_<pid>` database, migrate it with `drizzle-kit migrate`, run the real Server
Action against it, then drop it. See `next-app/test/int/harness.ts` for the full pattern
and the critical `DATABASE_URL`-before-dynamic-import ordering trap.

```bash
# from the repo root — start the docker-compose Postgres (already used by pnpm dev / e2e)
docker compose up -d postgres

cd next-app
pnpm test:int          # vitest run --config vitest.int.config.ts
```

**Graceful skip, not a hard failure:** if `TEST_DATABASE_URL` / `DATABASE_URL` is unset
*or* Postgres is unreachable, every `*.int.test.ts` file probes reachability up front
(`isPostgresReachable()`) and `describe.skipIf`s the whole suite with a clear
`console.warn` — `pnpm test:int` exits `0` (skipped, not failed) instead of erroring a
laptop or CI runner that never started the DB. This was verified directly: pointing
`TEST_DATABASE_URL` at an unreachable host produces `3 skipped (3)` / `10 skipped (10)`
with exit code 0 and a per-file warning; pointing it at the real docker-compose Postgres
produces `3 passed (3)` / `10 passed (10)`.

`pnpm test:int` and `pnpm check:orphans` currently run **outside** the default gate —
wiring them into `scripts/pre-merge-check.sh` / CI (so the middle layer can't silently
bit-rot) is tracked as E322.

## 5. Component layer (`pnpm test`, jsdom via a per-file pragma)

Component tests live in `next-app/test/component/*.test.tsx` and opt into the DOM
environment with a first-line pragma — no separate script, no separate config, and they
run as part of the default `pnpm test` (the main `vitest.config.ts` routes everything else
to the fast `node` environment):

```ts
// @vitest-environment jsdom
```

`test/setup.ts` wires up `@testing-library/jest-dom`'s matchers and an `afterEach(cleanup)`
(this repo does not enable vitest's `test.globals`, so Testing Library's own automatic
cleanup — which only registers against a *global* `afterEach` — never fires without it;
omitting this causes "found multiple elements" failures across component tests). Server
Actions imported by a component under test (e.g. `@/actions/items`, which has a top-level
`"use server"` + `import { db } from "@/lib/db"` that throws without `DATABASE_URL`) are
`vi.mock()`-ed — component tests never touch a real database; that's the integration
layer's job.

## 6. Division of labor with the manual plan

- **Automated (this file, §3)** — repeatable, deterministic, CI-gateable: wiring, DB
  side-effects, RBAC, aggregation correctness, new-feature regression.
- **Manual (`manual-test-plan/`)** — human judgment: copy/i18n correctness, color/visual
  states, RWD/dark-mode, concurrency *feel*, anything time-dependent that would make an
  e2e test flaky by construction.

A new feature PR should add the matching automated entry here; the manual plan only
covers what automation structurally can't reach.
