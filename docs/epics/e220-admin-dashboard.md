# E220 — Admin Dashboard

**Phase:** 53 | **Status:** ✅ Implemented | **Branch:** main (inline, no PR)

## Problem

No admin interface for managing users — no way to view all users, promote/demote roles, or remove accounts.

## Solution

Route: `/dashboard/admin` (`app/(dashboard)/dashboard/admin/`)

### Files

- `page.tsx` — Server Component; calls `requireAdmin()` + `getAllUsers()`, renders `<Table>` with role selector and delete button per row
- `_role-selector.tsx` — Client Component: shadcn `<Select>`, `onValueChange` → `startTransition(() => void setUserRole(userId, value))`
- `_delete-user-button.tsx` — Client Component: `<Button variant="destructive">`, `startTransition(() => void deleteUser(userId))`

### Server Actions (`actions/admin.ts`)

- `getAllUsers()` — `requireAdmin` → `db.select().from(usersTable).orderBy(asc(usersTable.createdAt))`
- `setUserRole(userId, role)` — `requireAdmin` → prevents self-demotion → `db.update`
- `deleteUser(userId)` — `requireAdmin` → prevents self-deletion → `db.delete`

### Safety guards

- Admins cannot demote themselves (would lock them out)
- Admins cannot delete themselves
- Route fully guarded by `requireAdmin()` (server-side) + middleware RBAC (Edge)

## Acceptance Criteria

- [x] Admin can view full user list with email, name, role, created date
- [x] Admin can change another user's role; page reflects change immediately (optimistic via `startTransition`)
- [x] Admin cannot change their own role
- [x] Admin can delete another user
- [x] Admin cannot delete themselves
- [x] Non-admin visiting `/dashboard/admin` is redirected to `/dashboard`

## Dependencies

- Requires E217 (FormState type)
- Requires E218 (requireAdmin, Role type)
