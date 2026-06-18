# E297 — TOTP Two-Factor Authentication

> Phase 69 · security · authentication hardening
> Status: ⬜ pending
> Deps: E296 (Connected Accounts tab shape informs Security tab slot)

## Problem

No 2FA of any kind exists in the codebase. The Settings page has a password tab but no Security/2FA tab. This is an OWASP A07 (Identification and Authentication Failures) gap. Enterprise and compliance-focused fork teams need TOTP 2FA as a baseline.

## Solution

Implement TOTP-based 2FA using `otplib`:
1. Settings Security tab — enable/disable 2FA, QR code setup, backup codes
2. DB migration — add `totp_secret` (nullable) + `backup_codes` (JSON array) to `usersTable`
3. Login challenge — after credentials check passes, if user has 2FA enabled, redirect to `/login/2fa` code entry step
4. Server Actions — `setupTotp`, `verifyTotpSetup`, `disableTotp`, `verifyTotpLogin`, `useBackupCode`
5. Unit tests — pure logic in `lib/totp-utils.ts` (token generation, verification, backup code hashing)

## Key Files

- `next-app/lib/schema/{auth,system}.ts` — add `totpSecret`, `totpEnabled`, `backupCodes` to `usersTable` (or migration 0008)
- `drizzle/migrations/` — next migration
- `next-app/lib/totp-utils.ts` (NEW) — pure TOTP logic (otplib wrapper, backup code gen/verify)
- `next-app/lib/totp-utils.test.ts` (NEW) — unit tests
- `next-app/actions/user.ts` — add `setupTotp`, `verifyTotpSetup`, `disableTotp`
- `next-app/actions/auth.ts` — add `verifyTotpLogin`, `useBackupCode`
- `next-app/app/(auth)/login/2fa/page.tsx` (NEW) — 2FA challenge page
- `next-app/app/(dashboard)/dashboard/settings/_security-tab.tsx` (NEW) — 2FA management UI
- `next-app/app/(dashboard)/dashboard/settings/_settings-tabs.tsx` — add Security tab

## Implementation

### Phase 1 — DB migration + pure utils
- Add columns to `usersTable`: `totpSecret TEXT`, `totpEnabled BOOLEAN DEFAULT false`, `backupCodes TEXT[]`
- Write `lib/totp-utils.ts`: `generateSecret()`, `generateQrUri()`, `verifyToken(secret, token)`, `generateBackupCodes(n=10)`, `hashBackupCode(code)`, `verifyBackupCode(hash, code)`
- Write `lib/totp-utils.test.ts`: verify token generation + verification cycle

### Phase 2 — Setup flow (Settings → Security tab)
- `_security-tab.tsx`: "Enable 2FA" button → modal with QR code + `<Input>` for first verify code
- Server Actions: `setupTotp` (generates secret, returns QR URI) + `verifyTotpSetup` (saves secret to DB, generates backup codes)
- "Disable 2FA" flow: requires current TOTP code + confirms via `ConfirmDialog`
- Display backup codes (one-time, after setup, with copy button)

### Phase 3 — Login challenge
- In `actions/auth.ts` login flow: after password check, if `totpEnabled`, set a session flag `pendingTotp: true`
- `/login/2fa` page: 6-digit input + "Use backup code" link
- Server Action `verifyTotpLogin`: verifies code → completes session
- Server Action `useBackupCode`: verifies + invalidates one backup code → completes session

## Acceptance Criteria

- [ ] Users can enable TOTP 2FA from Settings → Security tab
- [ ] QR code is displayed; scanning with an authenticator app produces valid codes
- [ ] After enabling, login requires a valid TOTP code after credentials check
- [ ] Backup codes are generated on setup, each usable once
- [ ] Users can disable 2FA (requires valid TOTP code to confirm)
- [ ] `lib/totp-utils.ts` has ≥ 80% unit test coverage
- [ ] DB migration applies cleanly on a fresh DB
- [ ] `pnpm typecheck` + `pnpm build` + `pnpm test` all pass

## Dependencies

- E296 — Settings Connected Accounts tab (informs the Security tab slot position)
- `otplib` npm package
- `qrcode` npm package (for QR URI → PNG)

## Out of Scope

- SMS/email OTP (TOTP only)
- WebAuthn / hardware keys
- TOTP enforcement as an org policy
- Recovery flow (lost authenticator) — backup codes only
