# E290 — Auth emails: password reset flow + wire invite emails

## Problem

Two gaps in the auth/team email story:

1. **No forgot-password flow.** A user who forgets their password has no way to recover the
   account. The login form shows a "忘記密碼？" link that points at `href="#"` (dead). There is
   no request page, no reset page, no token table, and no actions.
2. **Invites send no email.** `actions/team.ts::inviteMember` mints a token and returns it, but
   the only delivery channel is an admin copy/pasting the link from the admin panel UI. The
   invitee never receives anything automatically.

## Solution

### (a) Password reset

- New `password_reset_tokens` table in `lib/schema/auth.ts`, mirroring
  `emailVerificationTokens` (id / userId / token / expiresAt / createdAt). One Drizzle migration
  via `pnpm db:generate`.
- Pure, db-free token/expiry logic in `lib/password-reset-utils.ts`
  (`generateResetToken`, `resetExpiry`, `isResetTokenValid`) + unit test — mirrors `lib/team-utils.ts`.
- New Zod schemas in `lib/validations/auth.ts`:
  `forgotPasswordSchema` (email) and `resetPasswordSchema` (token + password reusing `passwordSchema`).
- New server actions in `actions/auth.ts`:
  - `requestPasswordReset(email)` — **always returns success** (no user enumeration). If the user
    exists *and* has a password (credentials user), delete any prior reset tokens, mint a new one,
    and send the reset email. Per-email cooldown to prevent email-bombing (reuse `cooldown`).
  - `resetPassword(token, newPassword)` — validate the new password with `resetPasswordSchema`,
    look up the token, reject if missing/expired (deleting the expired row), bcrypt the new
    password, update `usersTable.passwordHash`, delete the token. Returns `{ success }` / `{ error }`.
- New pages (route group `(auth)`):
  - `app/(auth)/forgot-password/page.tsx` + `_forgot-password-form.tsx` (request form).
  - `app/(auth)/reset-password/page.tsx` + `_reset-password-form.tsx` (token from `?token=`,
    new-password form; redirects to `/login?reset=true` on success).
- Login form "忘記密碼？" link now points to `/forgot-password`. Login page surfaces a
  `?reset=true` success banner.
- New query helper `getPasswordResetToken(token)` in `lib/queries.ts`.

### (b) Emails

- `lib/email.ts` gains:
  - `sendPasswordResetEmail(to, resetUrl)` — 繁中 copy, 1-hour expiry note.
  - `sendInviteEmail(to, inviteUrl, inviterName)` — 繁中 copy.
  Both modeled on `sendVerificationEmail`, through the existing nodemailer transport (Mailpit locally).
- `actions/team.ts::inviteMember` now calls `sendInviteEmail`, building the link from
  `NEXT_PUBLIC_APP_URL` (`${APP_URL}/invite/${token}`) and the inviter's `session.user.name`.
  Email send is best-effort (failure does not fail the invite — the admin still gets the link).

### (c) Tests

- `lib/password-reset-utils.test.ts` — db-free token/expiry unit tests.
- `lib/validations/auth.test.ts` — extended for the two new schemas.
- `actions/auth.test.ts` — action-shape integration tests (mock db/queries/email/password):
  `requestPasswordReset` non-enumeration + send-on-existing-user; `resetPassword` happy path +
  invalid/expired token.

## Key Files

- `lib/schema/auth.ts` — `passwordResetTokensTable`
- `lib/password-reset-utils.ts` (+ `.test.ts`)
- `lib/validations/auth.ts` (+ `.test.ts`)
- `lib/queries.ts` — `getPasswordResetToken`
- `lib/email.ts` — `sendPasswordResetEmail`, `sendInviteEmail`
- `actions/auth.ts` — `requestPasswordReset`, `resetPassword` (+ `actions/auth.test.ts`)
- `actions/team.ts` — wire `sendInviteEmail` into `inviteMember`
- `app/(auth)/forgot-password/{page,_forgot-password-form}.tsx`
- `app/(auth)/reset-password/{page,_reset-password-form}.tsx`
- `app/(auth)/login/{page,_login-form}.tsx` — link + `?reset=true` banner
- `drizzle/migrations/0007_*.sql` (generated) + `drizzle/test-migrate.ts` EXPECTED list

## Acceptance

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass.
- `pnpm db:generate` produces exactly ONE new migration adding `password_reset_tokens`.
- `requestPasswordReset` returns `{ success: true }` for both existing and non-existing emails
  (no enumeration); only sends an email when the user exists with a password.
- `resetPassword` rejects missing/expired tokens, updates the hash + deletes the token on success.
- `inviteMember` sends an invite email through the SMTP transport using `NEXT_PUBLIC_APP_URL`.
- All user-facing copy is 繁體中文. Pure logic stays db-free in `*-utils`. `cn()` / `@`-alias /
  Server-Component conventions respected.

## Out of scope

- e2e Playwright specs for the reset flow (kept to unit + action-shape per task scope).
- Rate-limiting beyond the existing per-email cooldown helper.
- Changing the invite token TTL or the existing email-verification flow.
- Auto-login after a successful password reset (user is sent to `/login`).
