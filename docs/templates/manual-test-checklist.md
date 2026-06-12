# Manual Test Checklist

> **Last tested:** YYYY-MM-DD | **Tester:** {{TESTER_NAME}}
> **Environment:** {{ENV_URL}} | **Branch/Tag:** {{BRANCH_OR_TAG}}
>
> Companion to [Unified Test Plan](./unified-test-plan.md) (E151) — the plan defines *what* to test; this checklist defines *how* to verify manually.

---

## How to Use

1. Copy this file or paste the tables into a GitHub issue
2. Replace `{{PLACEHOLDER}}` markers with project-specific values
3. Check pass/fail after each scenario — add notes for failures
4. Mark N/A for scenarios not applicable to current release

---

## Admin Scenarios

| # | Scenario | Steps | Expected Result | Pass/Fail | Notes |
|---|----------|-------|-----------------|-----------|-------|
| A1 | Admin login | 1. Go to `{{APP_URL}}/signin` 2. Enter `{{ADMIN_EMAIL}}` / `{{ADMIN_PASS}}` 3. Submit | Redirected to dashboard; admin nav items visible | ☐ | |
| A2 | User management list | 1. Navigate to admin panel 2. Open user list | All registered users displayed with email, status, created date | ☐ | |
| A3 | Deactivate user | 1. Select a non-admin user 2. Click deactivate 3. Confirm | User status changes to inactive; toast confirmation shown | ☐ | |
| A4 | Admin-only route guard | 1. Log in as regular user 2. Navigate to `{{APP_URL}}/admin` | Access denied or redirected to dashboard | ☐ | |
| A5 | System health check | 1. Log in as admin 2. Navigate to system health view | DB status, API version, uptime displayed without errors | ☐ | |

## User Scenarios

| # | Scenario | Steps | Expected Result | Pass/Fail | Notes |
|---|----------|-------|-----------------|-----------|-------|
| U1 | Registration | 1. Go to `{{APP_URL}}/signup` 2. Fill valid email + password 3. Submit | Account created; verification email sent or auto-redirected | ☐ | |
| U2 | Login + redirect | 1. Visit protected page while logged out 2. Login | Redirected to originally requested page after login | ☐ | |
| U3 | Password reset flow | 1. Click "Forgot password" 2. Enter email 3. Open reset link 4. Set new password | Password updated; can login with new password | ☐ | |
| U4 | Profile update | 1. Log in 2. Go to settings 3. Update display name 4. Save | Name updates immediately; persists after page refresh | ☐ | |
| U5 | Logout | 1. Click user menu 2. Click logout | Redirected to landing page; protected routes inaccessible | ☐ | |
| U6 | OAuth login | 1. Click `{{OAUTH_PROVIDER}}` button on signin 2. Authorize | Account linked; redirected to dashboard | ☐ | |

## Guest Scenarios

| # | Scenario | Steps | Expected Result | Pass/Fail | Notes |
|---|----------|-------|-----------------|-----------|-------|
| G1 | Landing page loads | 1. Open `{{APP_URL}}` in incognito | Landing page renders; no console errors; CTA visible | ☐ | |
| G2 | Protected route redirect | 1. Navigate to `{{APP_URL}}/dashboard` without auth | Redirected to `/signin` with return URL preserved | ☐ | |
| G3 | Public pages accessible | 1. Visit `/privacy` 2. Visit `/terms` | Both pages render correctly without auth | ☐ | |

## Cross-Cutting Scenarios

| # | Scenario | Steps | Expected Result | Pass/Fail | Notes |
|---|----------|-------|-----------------|-----------|-------|
| X1 | Keyboard navigation | 1. Start at signin page 2. Tab through all interactive elements 3. Press Enter to submit | All inputs/buttons reachable via Tab; focus ring visible; form submits | ☐ | |
| X2 | Mobile viewport | 1. Open app in 375×667 viewport (iPhone SE) 2. Navigate through signin → dashboard | Layout responsive; no horizontal scroll; touch targets >= 44px | ☐ | |
| X3 | Error state display | 1. Submit login with wrong password 2. Submit form with missing required fields | Error messages displayed inline; no raw error codes shown to user | ☐ | |
| X4 | Loading states | 1. Throttle network to Slow 3G 2. Trigger data fetch (e.g. dashboard load) | Loading spinner/skeleton shown; no layout shift on data arrival | ☐ | |
| X5 | Auth token expiry | 1. Log in 2. Wait for token to expire (or manually clear token) 3. Trigger API call | Refresh token kicks in silently, or user redirected to signin gracefully | ☐ | |
| X6 | Browser back/forward | 1. Navigate signin → dashboard → settings 2. Press Back 3. Press Forward | Each page renders correctly; no stale state or blank screens | ☐ | |

---

## Summary

| Role | Total | Passed | Failed | N/A |
|------|-------|--------|--------|-----|
| Admin | 5 | | | |
| User | 6 | | | |
| Guest | 3 | | | |
| Cross-cutting | 6 | | | |
| **Total** | **20** | | | |

**Blocking issues found:** (list any P0/P1 bugs here)

**Sign-off:** ☐ Ready for release | ☐ Blocked — see issues above
