# Migration Review — E327 (products + orders)

Migration: `next-app/drizzle/migrations/0011_luxuriant_dracula.sql`
Reviewed per the `drizzle-migration-safety` skill (Rule #19).

## Verdict: SAFE — expand-only, no destructive changes

## What it does
- `CREATE TYPE order_status AS ENUM('pending','paid','failed','refunded')` — new enum.
- `CREATE TABLE products` — new table (slug UNIQUE, amount integer minor-units,
  currency default `TWD`, active, entitlement_key, timestamps).
- `CREATE TABLE orders` — new table. `user_id` is NULLABLE (guest checkout by email);
  FKs: `product_id → products(id) ON DELETE restrict`, `user_id → users(id) ON DELETE set null`.
- 3 non-unique indexes on `orders` (product_id, user_id, provider_order_id).

## Safety checklist
- [x] No `DROP TABLE` / `DROP COLUMN` / `DROP INDEX`.
- [x] No `ALTER COLUMN TYPE` / in-place enum edits.
- [x] No `NOT NULL` added to an existing populated column (all columns are new).
- [x] New tables only — zero impact on existing rows / running instances (expand phase).
- [x] Idempotent settlement rides the EXISTING `payment_events.provider_event_id`
      UNIQUE constraint — no new idempotency machinery, no change to existing tables.
- [x] Applies cleanly on a fresh DB (`drizzle-kit generate` succeeded; snapshot in
      `drizzle/migrations/meta/`).

## Notes for deployment
- `amount` is stored in the smallest currency unit. For the launch currency **TWD**,
  ECPay 綠界 uses whole NTD, so amounts are effectively 1:1 (the demo product seeds
  `amount = 1200` = NT$1,200). Forks using USD one-time products should store cents.
- No backfill required — both tables start empty; the dev seed inserts one demo
  product (`slug = nextjs-course`).
- Revert-forward only (Drizzle has no down-migrations): to undo pre-release, add a new
  migration dropping `orders`, `products`, then the `order_status` type in that order.
