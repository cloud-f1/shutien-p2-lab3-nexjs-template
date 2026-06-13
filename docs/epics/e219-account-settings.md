# E219 — Account Settings Page

**Phase:** 53 | **Status:** ✅ Implemented | **Branch:** main (inline, no PR)

## Problem

No way for users to update their profile name/avatar or change their password after registration.

## Solution

Route: `/dashboard/settings` (`app/(dashboard)/dashboard/settings/`)

### Files

- `page.tsx` — Server Component; calls `requireAuth()`, renders `<ProfileForm>` + `<Separator>` + `<PasswordForm>`
- `_profile-form.tsx` — Client Component (RHF): `updateProfileSchema`, `startTransition` → `updateProfile` Server Action, shows server messages inline
- `_password-form.tsx` — Client Component (RHF): `changePasswordSchema`, `startTransition` → `changePassword`, `reset()` on success

### Server Actions (`actions/user.ts`)

- `updateProfile(prevState, formData)` — `requireAuth` → Zod parse → `db.update(usersTable)`
- `changePassword(prevState, formData)` — `requireAuth` → verify current password with `bcryptjs.compare` → hash new password → `db.update`

## RHF + Server Action pattern

These forms return state (no `redirect()`), so:
1. RHF validates client-side with `zodResolver`
2. `handleSubmit(onValid)` → manual `FormData` construction → `startTransition(() => await action(null, fd))`
3. Server response sets inline success/error message

## Acceptance Criteria

- [x] Profile name updates persist (DB write confirmed)
- [x] Password change succeeds with valid current password
- [x] Password change fails with wrong current password (server error shown)
- [x] Mismatched `confirmPassword` shows client-side Zod error
- [x] Password form resets after successful change
- [x] Route requires authentication (`requireAuth`)

## Dependencies

- Requires E217 (updateProfileSchema, changePasswordSchema, FormState)
- Requires E218 (requireAuth from lib/permissions.ts)
