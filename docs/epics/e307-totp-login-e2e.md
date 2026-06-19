# E307 — TOTP Login e2e

> Phase 72 · test coverage · auth verification
> Status: ⬜ pending

## Problem

E297 shipped TOTP 2FA (setup tab, `/login/2fa` challenge, backup codes) with unit (`totp-utils`) + build coverage, but **no end-to-end test** exercises the real login challenge. The 2FA gate (password → pending-2fa cookie → nonce exchange in `authorize()`) is exactly the kind of multi-step auth flow that unit tests can't cover. Per the loop's "smoke the real critical path" rule, auth changes need an e2e that actually logs in.

## Solution

Add a Playwright e2e (`e2e/two-factor.spec.ts`) covering the 2FA flow against a seeded user:
1. Enable 2FA from Settings → Security (generate secret, verify a TOTP code computed in-test via `otplib`, capture backup codes)
2. Log out, log in with password → assert redirect to `/login/2fa` (not dashboard)
3. Enter a valid TOTP code → assert landing on the dashboard
4. Backup-code path: log in → use a backup code → assert dashboard + that the code is single-use
5. Negative: wrong code → stays on `/login/2fa` with an error

Reuse the existing e2e harness (`e2e/auth-flow.spec.ts` login helper). Compute live TOTP codes in-test with `otplib` (already a dep from E297). Seed or create a 2FA-enabled user in test setup.

## Key Files

- `next-app/e2e/two-factor.spec.ts` (NEW)
- `next-app/e2e/auth-flow.spec.ts` — login helper reference
- `next-app/lib/totp-utils.ts` — token generation parity in-test
- `next-app/drizzle/seed.ts` — optionally seed a 2FA-enabled demo user (or enable in-test)

## Acceptance Criteria

- [ ] `e2e/two-factor.spec.ts` covers: enable → challenge-on-login → valid code → dashboard
- [ ] Backup-code login path tested (single-use enforced)
- [ ] Negative path (wrong code) tested
- [ ] `pnpm test:e2e -- --grep "2fa|two-factor"` passes against a booted, seeded stack
- [ ] No change to production code unless a test-blocking bug is found (then fix + note it)

## Out of Scope

- 2FA recovery / lost-authenticator (E310)
- Rate-limit assertions on the 2FA endpoint (covered by E298 unit tests)
