# E268 — Webhooks

**Phase:** 62 | **Status:** ⬜ | **Depends:** none

## Problem

No way for users to subscribe external systems to app events, nor a record of delivery attempts.

## Solution

`webhooks` + `webhook_deliveries` Drizzle tables, an HMAC-SHA256 signed dispatcher with retry/backoff, and a System UI (CRUD + delivery log).

## Key Files

- `next-app/lib/schema.ts` — `webhooksTable`, `webhookDeliveriesTable` (additive)
- `next-app/lib/webhooks.ts` — `dispatchEvent(event, payload)` (sign + POST + record + retry)
- `next-app/actions/webhooks.ts` — create/update/delete/test (`"use server"`, owner-scoped)
- `next-app/app/(dashboard)/dashboard/system/webhooks/*` — CRUD + delivery log UI
- `next-app/lib/webhooks.test.ts` — signature, delivery record shape

## Implementation

1. `webhooksTable`: `id` · `userId` fk · `url` · `events` text[] · `secret` · `active` bool · `createdAt`.
2. `webhookDeliveriesTable`: `id` · `webhookId` fk(cascade) · `event` · `status` (pending/success/failed) · `responseCode` · `attempts` int · `payload` jsonb · `createdAt`.
3. `dispatchEvent`: for each active sub to the event → sign body with HMAC-SHA256(secret) in `X-Signature` → POST → record delivery → on failure, exponential backoff up to N attempts.
4. "Send test" action emits a sample event. Owner-scoped CRUD.

## Acceptance Criteria

- [ ] Webhook CRUD works; `dispatchEvent` signs + records a delivery row.
- [ ] Failed deliveries retry with backoff + are logged.
- [ ] `pnpm test` covers signature + delivery record; typecheck+lint+build green.

## Out of Scope

- A background queue/cron worker (synchronous dispatch + retry helper only). Per-event payload schemas.

## Migration note

Adds tables to `lib/schema.ts`. One Drizzle migration after all Phase 62 schema additions (no per-worktree migrations).
