# S1 — Auth + RBAC Enforcement

Priority: **P0**. Automation coverage: 🤖 `test/int/rbac.int.test.ts` proves the
`requireEditor()`/`requireAuth()` DB-side guard (viewer/unauthenticated rejected, admin
let through) at the Server Action layer. This suite verifies the **UX** around that same
guard — what a human actually sees — plus registration/login/2FA flows automation covers
only at the happy-path e2e level (`e2e/auth-flow.spec.ts`, `e2e/two-factor.spec.ts`).

UI is Traditional Chinese (繁體中文) — exact on-screen copy is quoted per step so you can
match it precisely.

---

### [S1-01] Register a new account 〔Priority: P1〕〔Role: anonymous〕

- **Preconds**: Logged out. On `/register`.
- **Steps**:
  1. Fill 姓名 (name), 電子郵件 (email, use an address you haven't used before), 密碼 (password).
  2. Submit.
  3. Open mailpit (http://localhost:8025) and find the verification email.
  4. Click the verification link.
- **Expected**:
  - After submit you land on a "check your inbox" state (請檢查您的收件匣-style copy) — not
    a silent no-op and not an error.
  - The verification email arrives in mailpit within a few seconds.
  - Clicking the link confirms the account (redirects to a success state, not an error).
  - You can now log in with the new email/password.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S1-02] Register with an already-used email 〔Priority: P1〕〔Role: anonymous〕

- **Preconds**: Logged out. On `/register`.
- **Steps**:
  1. Register with `admin@example.com` (already seeded).
- **Expected**:
  - A clear inline error is shown. **The response must not confirm or deny whether the
    email already has an account** (non-enumeration) — the message should read the same
    generic way it would for a different validation failure, not "this email is already
    registered."
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S1-03] Login — demo quick-login buttons 〔Priority: P2〕〔Role: anonymous〕

- **Preconds**: Logged out. On `/login`. Local/dev environment only (demo login may be
  disabled in staging/prod — if so, skip and note that it's correctly hidden).
- **Steps**:
  1. Under "快速示範登入", click each of Admin / Editor / Viewer in turn (logging out
     between each).
- **Expected**:
  - Each button logs straight in as that seeded account — no manual credential entry.
  - The dashboard's visible nav/actions differ per role (see S1-06/S1-07).
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S1-04] Login — wrong password 〔Priority: P0〕〔Role: anonymous〕

- **Preconds**: Logged out. On `/login`.
- **Steps**:
  1. Enter `admin@example.com` with an intentionally wrong password. Submit.
- **Expected**:
  - A generic "incorrect email or password" style error — does not reveal whether the
    email exists.
  - You remain on `/login`, not silently redirected anywhere.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S1-05] Login rate limiting 〔Priority: P1〕〔Role: anonymous〕

- **Preconds**: Logged out. On `/login`. (See README §7 — don't confuse this with a
  regression if S1-04 starts failing right after this case.)
- **Steps**:
  1. Submit 5+ wrong-password attempts for the same email in quick succession.
- **Expected**:
  - After some threshold, further attempts are blocked/cooled-down with a distinct
    message (not just repeating "incorrect email or password" forever).
  - The cooldown clears after waiting (don't need to time it precisely — just confirm it
    isn't permanent).
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S1-06] RBAC — viewer sees read-only affordances 〔Priority: P0〕〔Role: viewer〕 🤖 partial

> 🤖 automation-covered: the underlying guard rejection (no row written, redirected) is
> proven at `test/int/rbac.int.test.ts`. This case verifies the viewer never even sees an
> action they'd be blocked from — the UX should hide/disable, not merely reject.

- **Preconds**: Logged in as `viewer@example.com`.
- **Steps**:
  1. Go to Dashboard → Items.
  2. Look for a create/新增 button or an edit/delete action on any row.
  3. Go to Dashboard → Admin.
- **Expected**:
  - No create/edit/delete affordance is visible on the Items page for a viewer (or it is
    visibly disabled with a clear reason) — items are still listed (viewers can read).
  - The Admin section is inaccessible or clearly locked for a viewer.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S1-07] RBAC — live-role demotion takes effect without re-login 〔Priority: P0〕〔Role: admin + editor〕 🤖 partial

> 🤖 automation-covered: `requireEditor()` re-reads the role from the DB rather than the
> session JWT — proven directly at the Server Action layer by
> `test/int/rbac.int.test.ts`. This case is the reason that guard exists: verify the
> **UX** an already-logged-in user gets the instant they're demoted.

- **Preconds**: Two browser sessions (or one regular + one incognito): session A as
  `admin@example.com`, session B as `editor@example.com` (already logged in before the
  demotion happens).
- **Steps**:
  1. In session A, go to Dashboard → Admin and demote the editor account to viewer.
  2. In session B (already logged in, do NOT log out/in), attempt to create an item.
- **Expected**:
  - Session B's create action is rejected **on this very next request** — not "only after
    they log out and back in." The rejection is communicated clearly (not a silent
    failure or a generic 500).
  - Re-promote the account back to editor afterward to leave seed state clean.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S1-08] Forgot password → reset flow (via mailpit) 〔Priority: P1〕〔Role: anonymous〕

- **Preconds**: Logged out. A verified test account exists (use one you registered in
  S1-01, not a seed account — don't churn the seed accounts' passwords).
- **Steps**:
  1. On `/forgot-password`, submit the account's email.
  2. In mailpit, open the reset email and click the link.
  3. Set a new password and submit.
  4. Log in with the new password.
- **Expected**:
  - The "check your inbox" state appears regardless of whether the email exists
    (non-enumeration — same as S1-02).
  - The reset link works exactly once — reusing it after a successful reset shows an
    expired/invalid state, not a second successful reset.
  - Login with the new password succeeds; the old password no longer works.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S1-09] Two-factor (TOTP) setup + enforced login 〔Priority: P1〕〔Role: any〕

- **Preconds**: Logged in as a non-seed test account (2FA setup is destructive to that
  account's login flow for the rest of the session — don't do this to a shared seed
  account without disabling it again afterward).
- **Steps**:
  1. Dashboard → Settings → Security tab. Click the setup/啟用 action.
  2. Scan the QR (or enter the secret) in an authenticator app, enter the 6-digit code,
     confirm.
  3. Save the shown backup codes (「我已儲存」 confirms you've stored them).
  4. Log out, log back in with email/password.
- **Expected**:
  - Setup requires a valid 6-digit code before it completes — a wrong code shows an error
    and does NOT enable 2FA.
  - Backup codes are shown exactly once at setup time.
  - After setup, logging in with just email/password stops at a **兩步驟驗證** step
    (`/login/2fa`) before reaching the dashboard — it does not grant a session on
    password alone.
  - Entering a valid TOTP code (or a backup code, format `xxxx-xxxx`) completes login.
  - A used backup code cannot be reused for a subsequent login.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S1-10] Admin resets a user's TOTP (account-recovery path) 〔Priority: P2〕〔Role: admin〕

- **Preconds**: A test account has 2FA enabled (from S1-09) and has lost access to its
  authenticator (simulated).
- **Steps**:
  1. As admin, go to Dashboard → Admin, find the account, use the reset-2FA action.
  2. Log in as that account with just email/password.
- **Expected**:
  - After the admin's reset, 2FA is fully disabled for that account — login succeeds
    without a 2FA step (until the user re-enables it themselves).
  - This action is only reachable by admin (viewer/editor should not see it, per S1-06's
    admin-panel visibility check).
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________
