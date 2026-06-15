# E264 — Settings Expansion

**Phase:** 61 | **Status:** ⬜ | **Depends:** E259

## Problem

We have a basic account settings page (profile + password). The Cobalt design has a full tabbed Settings: Profile · Account (2FA, localization, danger zone) · Notifications · Appearance · Connected accounts.

## Solution

Expand `/dashboard/settings` into a tabbed layout reusing our existing profile/password forms, adding the missing panels. UI + prefs only here; deeper backend (2FA secret, notification prefs storage) is wired in Phase 62.

## Key Files

- `next-app/app/(dashboard)/settings/**` — tabbed shell (shadcn `tabs`)
- `next-app/components/settings/*` (new) — appearance (theme + density placeholder), notifications-prefs, connected-accounts (reads Auth.js `accounts`), 2FA section (stub → E62)
- (ref: `/tmp/cobalt-design/ai-app/project/cobalt/app/page-settings.jsx`)

## Implementation

1. Tabs: Profile · Account · Notifications · Appearance · Connected.
2. Profile/password reuse existing forms (keep e2e selectors intact).
3. Appearance: theme toggle + (future) density. Connected: list linked OAuth `accounts`. Notifications: toggle prefs (local until E272/E62). 2FA: enable-stub with a note it activates in Phase 62.
4. Danger zone: delete-account (reuse existing if present).

## Acceptance Criteria

- [ ] `/dashboard/settings` is tabbed; profile + password still work (e2e green — selectors unchanged).
- [ ] New panels render in light/dark; copy via existing i18n.
- [ ] `pnpm build` + lint + typecheck green.

## Out of Scope

- TOTP secret persistence + verification (Phase 62/E264-follow). Notification delivery (E272).
