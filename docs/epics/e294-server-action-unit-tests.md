# E294 — Server Action Unit Tests (admin / items / user)

> Phase 69 · test coverage · risk reduction
> Status: ⬜ pending

## Problem

Three action domains ship mutation logic to production with no db-free unit tests:

- `actions/admin.ts` — `changeUserRole`, `deleteUser`, `banUser` (only `lib/is-admin.ts` is tested; the admin *mutations* are not)
- `actions/items.ts` — item CRUD (no `lib/items-utils.ts`; `lib/validations/items.ts` exists but has no test, unlike `auth`/`user` validations)
- `actions/user.ts` — `changePassword`, `updateProfile` (the Zod schema in `lib/validations/user.ts` is tested, but the action's permission gates + password-change rules are not)

For a fork team shipping these to production, the permission gates and validation branches have no automated contract. The already-covered domains (api-keys, notifications, team, webhooks) show the pattern — these three are the genuine gap.

## Already covered (do NOT re-create — verified present)

- `lib/api-keys-utils.ts` + `lib/api-keys-utils.test.ts` ✅
- `lib/team-utils.ts` + `lib/team-utils.test.ts` ✅
- `lib/webhooks-utils.ts` + `lib/webhooks-utils.test.ts` ✅
- `lib/notifications-utils.ts` + `lib/notifications.test.ts` ✅
- `lib/is-admin.ts` + `lib/is-admin.test.ts` ✅ (role check only)
- `lib/validations/{auth,user}.test.ts` ✅

## Solution

Follow the existing `lib/*-utils.ts` + co-located `*.test.ts` pattern. For each of the 3 gap domains:
1. Extract db-free logic from the action into a `lib/*-utils.ts` module (validation, permission gates, state transitions)
2. Write a co-located Vitest `*.test.ts` covering: happy path, permission gate (role check), input-validation edge cases, error branches
3. Add the missing `lib/validations/items.test.ts` for the items Zod schema (parity with auth/user)

Target: ~18–24 new test cases across 3 domains. All db-free — must run in `pnpm test`.

## Key Files

- `next-app/actions/admin.ts` → `lib/admin-utils.ts` (NEW) + `lib/admin-utils.test.ts` (NEW)
- `next-app/actions/items.ts` → `lib/items-utils.ts` (NEW) + `lib/items-utils.test.ts` (NEW)
- `next-app/actions/user.ts` → `lib/user-utils.ts` (NEW) + `lib/user-utils.test.ts` (NEW)
- `next-app/lib/validations/items.test.ts` (NEW) — Zod schema parity with auth/user
- `next-app/vitest.config.ts` — confirm coverage include picks up new `lib/*-utils.ts`

## Implementation

### Phase 1 — admin
- Extract `assertCanManageUser(actorRole, targetRole)`, role-change validity, self-action guard into `lib/admin-utils.ts`
- Tests: admin can demote editor; admin cannot delete self; viewer cannot call admin ops

### Phase 2 — items
- Extract item create/update validation + ownership check into `lib/items-utils.ts`
- Add `lib/validations/items.test.ts`
- Tests: valid item passes; missing required field rejected; non-owner cannot edit

### Phase 3 — user
- Extract `changePassword` rules (current-password required, new ≠ old, complexity) + `updateProfile` validation into `lib/user-utils.ts`
- Tests: weak new password rejected; mismatched current password rejected; profile update validates email
- Run `pnpm test:coverage` — confirm ≥ 80% stmt on the 3 new utils files

## Acceptance Criteria

- [ ] `lib/{admin,items,user}-utils.ts` exist with co-located `*.test.ts`
- [ ] `lib/validations/items.test.ts` exists (parity with auth/user)
- [ ] `pnpm test` passes (no DB required)
- [ ] `pnpm test:coverage` shows ≥ 80% stmt coverage on each new `lib/*-utils.ts`
- [ ] No `actions/**` file is imported by any test (all tests db-free)
- [ ] The 4 already-covered domains (api-keys/notifications/team/webhooks) are NOT touched

## Out of Scope

- The 4 already-tested action domains (api-keys, notifications, team, webhooks)
- End-to-end tests for these actions (covered by Playwright)
- Integration tests requiring a live DB
