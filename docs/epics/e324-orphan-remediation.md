# E324 — Orphan Remediation (wire-or-delete the 8 tested-but-unwired guards)

> Phase 76 · correctness · follow-up to E320
> Status: ⬜ pending
> ⚠️ **Behavior-changing** — each fix either starts enforcing a guard that was silently bypassed, or removes dead code. Ships with tests + a review gate.

## Problem

E320's `check:orphans` found **8 `lib/` exports with unit tests but zero production call-sites** — tested-but-never-wired. Some are latent security/correctness bugs (a guard that's written + tested but never called doesn't protect anything). Each must be triaged: **wire it in** (the orphan is the correct implementation the call site should use) or **delete it** (dead duplicate; the inline version is authoritative).

## The 8 orphans (from E320's run)

| # | Orphan (file) | Current reality | Likely action |
|---|---|---|---|
| 1 | `assertPasswordChanged` (`lib/user-utils.ts`) | `actions/user.ts` `changePassword` never calls it → a no-op (same-password) change isn't blocked | **wire** (or delete if intentionally allowed) |
| 2 | `isUniqueViolationOn` (`lib/billing/idempotency-utils.ts`) | webhook/return routes call the weaker sibling `isUniqueViolation` (no constraint check) | **wire** the constraint-aware version at the idempotency sites |
| 3 | `assertItemOwner` (`lib/items-utils.ts`) | `actions/items.ts` uses inline DB where-clauses | wire **or** delete (if inline is authoritative) |
| 4 | `assertCanWriteItems` (`lib/items-utils.ts`) | same | wire **or** delete |
| 5 | `assertAdminRole` (`lib/admin-utils.ts`) | `actions/admin.ts` does inline role checks | wire **or** delete |
| 6 | `assertAuthenticatedUser` (`lib/user-utils.ts`) | fully unwired; actions use `requireAuth()` | likely **delete** (requireAuth is the real guard) |
| 7 | `generateNonce` (`lib/totp-utils.ts`) | `lib/pending-2fa.ts` `issueNonce` duplicates the `randomBytes` logic | **wire** (call it) or delete the duplicate |
| 8 | `aggregateUsage` (`lib/usage-utils.ts`) | `lib/db/queries/usage.ts` sums via raw SQL | wire **or** delete |

## Solution

For **each** orphan, in order of risk (1, 2 first — real bugs):
1. Read the orphan + its inline alternative + the tests.
2. Decide **wire** (replace the inline logic with a call to the tested function) or **delete** (remove the orphan + its now-pointless test, if the inline version is correct and preferred). Record the decision + rationale in the commit.
3. If wiring changes behavior (e.g. #1 now rejects no-op password changes, #2 tightens idempotency), add/adjust a test that proves the NEW behavior, and note the behavior change in the PR.
4. Re-run `pnpm check:orphans` — the count must drop by each fixed item; target **0 remaining** (or a documented, justified allowlist for any genuinely public-API export).

## Key Files
- `next-app/lib/{user-utils,items-utils,admin-utils,totp-utils,usage-utils}.ts`, `next-app/lib/billing/idempotency-utils.ts`
- Call sites: `next-app/actions/{user,items,admin}.ts`, `next-app/lib/pending-2fa.ts`, `next-app/lib/db/queries/usage.ts`, billing webhook/return route handlers
- Tests alongside each

## Acceptance Criteria
- [ ] All 8 orphans resolved (wired or deleted), each with a one-line rationale
- [ ] `pnpm check:orphans` → 0 orphans (or documented allowlist)
- [ ] Behavior changes (esp. #1 password no-op, #2 billing idempotency) covered by a test + called out in the PR
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm test:int` green (or graceful-skip)
- [ ] `make guard-selftest` still passes

## Cross-Epic
- E320 — this remediates what its `check:orphans` tool found
- E323 — several actions now use `defineAction`; wire guards through the factory's `authorize` hook where it fits

## Out of Scope
- New features; only wiring/removing existing tested logic
- The 3 remaining `@saas` modules → E325
