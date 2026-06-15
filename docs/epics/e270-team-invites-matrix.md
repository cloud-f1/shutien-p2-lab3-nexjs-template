# E270 — Team Invites + Permission Matrix

**Phase:** 62 | **Status:** ⬜ | **Depends:** E269

## Problem

The admin panel lists users + changes roles, but there's no invite flow, member-status lifecycle, or a clear permission matrix.

## Solution

An `invitations` Drizzle table + member `status` on users + invite/accept/revoke flow + a permission-matrix UI, extending the existing admin panel. Sensitive actions call `logAudit()` (E269).

## Key Files

- `next-app/lib/schema.ts` — `invitationsTable` + add `status` to `usersTable` (active/invited/suspended)
- `next-app/actions/team.ts` — `inviteMember`, `acceptInvite(token)`, `revokeInvite` (`"use server"`, admin-gated)
- `next-app/app/(dashboard)/dashboard/admin/*` — invite modal + members table (status badges via StatusBadge) + permission matrix
- `next-app/app/(auth)/invite/[token]/page.tsx` — accept-invite landing
- `next-app/actions/team.test.ts` — invite token, accept, role gate

## Implementation

1. `invitationsTable`: `id` · `email` · `role` (roleEnum) · `token` (unique) · `status` (pending/accepted/revoked) · `invitedBy` fk · `expiresAt` · `createdAt`.
2. `usersTable.status` (new enum: active/invited/suspended; default active; migration maps existing → active).
3. `inviteMember` (admin): create invitation + token; (email send optional — log link in dev). `acceptInvite`: validate token+expiry → create/activate user. `revokeInvite`. All call `logAudit`.
4. Permission matrix: static admin/editor/viewer × capabilities table (reads from the existing `lib/permissions` rules) + member status badges.

## Acceptance Criteria

- [ ] Admin can invite (pending row + token), accept activates, revoke disables.
- [ ] Permission matrix renders; member statuses shown; all admin-gated (editor/viewer blocked).
- [ ] Audit entries written for invite/revoke; `pnpm test` green; typecheck+lint+build green; e2e RBAC unaffected.

## Out of Scope

- Real email delivery (reuse existing mailer if trivial; else log the link). SCIM/SSO provisioning.

## Migration note

Adds `invitationsTable` + `usersTable.status` to `lib/schema.ts`. One Drizzle migration after all Phase 62 schema additions; the `status` default-backfill must be in that migration.
