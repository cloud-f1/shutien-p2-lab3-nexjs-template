# E275 — Schema reorganization + constraints/indexes

> Phase 64 · data layer · branch `feat/E275-schema-hardening`
> Source: the 2026-06-15 API↔schema audit. Confirmed scope: split + full constraints/indexes.

## Problem (from audit)

`lib/schema.ts` was a single 279-line file mixing 5 concerns, and **zero indexes/constraints
existed on any FK or lookup column**: no UNIQUE on `subscriptions.provider_sub_id` (webhooks
depend on it for idempotent upsert), no UNIQUE on `api_keys.prefix` (8-hex lookup), and
`accounts`/`verification_tokens` lacked the Auth.js-adapter composite primary keys. Every
owner-scoped `WHERE userId = …` (items/webhooks/notifications/audit/invitations) was a full scan.

## Solution

1. **Split** `lib/schema.ts` → `lib/schema/{auth,items,billing,system}.ts` + an `index.ts`
   barrel. `@/lib/schema` resolves to the barrel — **no consumer import changes**. `drizzle.config`
   → `./lib/schema/index.ts`. `roleEnum` defined once in `auth.ts`, imported by `system.ts`.
2. **Constraints + indexes** (migration `0006`, behaviour-identical otherwise):
   - composite PKs: `accounts(provider, provider_account_id)`, `verification_tokens(identifier, token)`
   - UNIQUE: `subscriptions.provider_sub_id`, `api_keys.prefix`
   - indexes on every FK/lookup: `items/webhooks/notifications/subscriptions/api_keys.user_id`,
     `audit_log.actor_id`, `webhook_deliveries.webhook_id`, `invitations.invited_by` + `.email`

## Key Files

`next-app/lib/schema/{auth,items,billing,system,index}.ts` (split) · `drizzle.config.ts` (schema path)
· `drizzle/migrations/0006_spooky_rachel_grey.sql` (constraints/indexes).

## Acceptance Criteria

- [x] Split is behaviour-identical — drizzle diff is constraints/indexes only (no table/column changes).
- [x] `@/lib/schema` imports unchanged across all consumers (typecheck clean).
- [x] Migration applies on a fresh DB (`db:test-migrate`: 15 tables, 7 migrations) + the dev DB.
- [x] 232 unit tests + production build green.

## Out of Scope (→ E276)

The `provider_sub_id` UNIQUE here **enables** the webhook `onConflictDoUpdate` fix, but the code
change (idempotent upsert) lands in E274/E276. Convention cleanups (add `updatedAt` to mutated
system tables, promote `webhook_deliveries.status`/`audit_log` to enums) → E276.
