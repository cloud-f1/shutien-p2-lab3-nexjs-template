# E272 — Notifications

**Phase:** 62 | **Status:** ⬜ | **Depends:** none

## Problem

The E263 `NotificationsMenu` dropdown shows a hardcoded placeholder feed. There's no notifications table or read-state.

## Solution

A `notifications` Drizzle table + mark-read / mark-all-read Server Actions + wire the existing dropdown to real, per-user data.

## Key Files

- `next-app/lib/schema.ts` — `notificationsTable` (additive)
- `next-app/actions/notifications.ts` — `markRead(id)`, `markAllRead` (`"use server"`, owner-scoped)
- `next-app/lib/notifications.ts` — `getNotifications(userId)`, `createNotification(...)`
- `next-app/components/notifications-menu.tsx` — replace placeholder with real data (server-fetched count + items)
- `next-app/lib/notifications.test.ts` — create + mark-read

## Implementation

1. `notificationsTable`: `id` · `userId` fk(cascade) · `title` · `body` · `type` (info/success/warning/error) · `readAt` (nullable) · `createdAt` (indexed).
2. The topbar fetches the user's recent notifications + unread count (server) and passes to `NotificationsMenu`; the dropdown's mark-read calls the action + revalidates.
3. `createNotification` helper for other features to emit (e.g. invite accepted, key revoked) — optional wiring.
4. Owner-scoped: users see only their own.

## Acceptance Criteria

- [ ] Dropdown shows real per-user notifications + unread count; mark-read / mark-all-read work + persist.
- [ ] Owner-scoped; empty state when none.
- [ ] `pnpm test` covers create + mark-read; typecheck+lint+build green.

## Out of Scope

- Realtime push (websockets/SSE) — poll/revalidate only. Email/digest delivery.

## Migration note

Adds a table to `lib/schema.ts`. One Drizzle migration after all Phase 62 schema additions.
