# E310 — 2FA Recovery + Server-Side Onboarding Persistence

> Phase 72 · auth hardening + UX (builds on E297, E300)
> Status: ⬜ pending · migration 0011

## Problem

Two documented deferrals from Phase 69/70:
1. **2FA recovery (E297 excl.)** — a user who loses their authenticator AND their backup codes is locked out; there's no admin-assisted reset. Backup codes are the only recovery, and once exhausted there's no path back.
2. **Onboarding persistence (E300 excl.)** — onboarding completion is `localStorage`-only, so it doesn't survive a device change and can't be reported on server-side.

## Solution

### Part A — 2FA recovery (admin-assisted reset)
- Admin action `resetUserTotp(userId)` in `actions/admin.ts` — admin-gated, clears `totpSecret`/`totpEnabled`/`backupCodes`, writes an audit-log entry. Surfaced as a "Reset 2FA" control in the admin user panel (with `ConfirmDialog`).
- Self-service: a "regenerate backup codes" action in the Security tab (requires a valid current TOTP code) so a user low on codes can refresh them.
- Unit-test the pure guards (admin-only; regenerate requires valid code) in `admin-utils`/`totp-utils`.

### Part B — Onboarding persistence
- Add `onboardingCompletedAt` (timestamp, nullable) + `onboardingDismissed` (boolean) to `usersTable` → **migration 0011**.
- `useOnboarding` hook reads server state first (hydrated from the user record), falls back to `localStorage` for anonymous/optimistic; a `completeOnboarding()`/`dismissOnboarding()` Server Action persists to the DB.
- Keep the localStorage path as a fast optimistic layer; DB is the source of truth.

## Key Files

- `next-app/lib/schema/auth.ts` — `onboardingCompletedAt`, `onboardingDismissed` on users
- `next-app/drizzle/migrations/` — **0011**
- `next-app/actions/admin.ts` — `resetUserTotp` (+ admin user panel control)
- `next-app/actions/user.ts` — `regenerateBackupCodes`, `completeOnboarding`, `dismissOnboarding`
- `next-app/app/(dashboard)/dashboard/settings/_security-tab.tsx` — regenerate-codes UI
- `next-app/app/(dashboard)/dashboard/admin/` — Reset-2FA control
- `next-app/hooks/use-onboarding.ts` — server-state hydration
- `next-app/lib/{admin,totp}-utils.ts` + tests

## Acceptance Criteria

- [ ] Admin can reset a user's 2FA (gated, audit-logged, ConfirmDialog)
- [ ] User can regenerate backup codes with a valid current TOTP code
- [ ] `onboardingCompletedAt`/`onboardingDismissed` columns + migration 0011 (fresh-DB verified)
- [ ] Onboarding state persists across devices (DB source of truth; localStorage optimistic)
- [ ] New guards unit-tested; `pnpm typecheck && pnpm lint && pnpm test && pnpm build` + `db:test-migrate` pass

## Out of Scope

- Email/SMS-based 2FA recovery (admin reset only)
- WebAuthn / passkeys
