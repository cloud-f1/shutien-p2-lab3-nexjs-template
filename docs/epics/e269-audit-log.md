# E269 — Audit Log

**Phase:** 62 | **Status:** ⬜ | **Depends:** none

## Problem

Sensitive actions (role changes, key revocation, invites) leave no in-app trail. B2B/compliance needs an audit log.

## Solution

An `audit_log` Drizzle table + a `logAudit()` server helper invoked from sensitive Server Actions + an admin-only viewer UI with filters.

## Key Files

- `next-app/lib/schema.ts` — `auditLogTable` (additive)
- `next-app/lib/audit.ts` — `logAudit({ actorId, action, targetType, targetId, metadata })`
- `next-app/app/(dashboard)/dashboard/system/audit/page.tsx` — admin viewer (filter by actor/action)
- callers: `actions/admin.ts` (role change), `actions/api-keys.ts` (revoke), `actions/team.ts` (E270 invites)
- `next-app/lib/audit.test.ts` — write + query

## Implementation

1. `auditLogTable`: `id` · `actorId` fk→users(set null) · `action` (e.g. `user.role_changed`) · `targetType` · `targetId` · `metadata` jsonb · `createdAt` (indexed).
2. `logAudit()` — fire-and-forget insert; never throws into the caller (wrap in try/catch).
3. Wire into existing sensitive actions (role change at minimum); E267/E270 also call it.
4. Viewer: admin-only (`requireAdmin`), paginated, filter by actor + action.

## Acceptance Criteria

- [ ] `logAudit` writes a row; a role change produces an audit entry.
- [ ] Viewer is admin-only (viewer/editor blocked) + filters work.
- [ ] `pnpm test` covers write+query; typecheck+lint+build green.

## Out of Scope

- Export/retention policy (that's a later "data retention" item). Tamper-proofing.

## Migration note

Adds a table to `lib/schema.ts`. One Drizzle migration after all Phase 62 schema additions.
