# E296 — GitHub Social Login

> Phase 69 · authentication · social providers
> Status: ⬜ pending

## Problem

Only Google OAuth is wired as a social login provider. The `accountsTable` and `DrizzleAdapter` already support multi-provider (composite PK on `provider+providerAccountId`), but `lib/auth.ts` imports only `Google` from `next-auth/providers/google`.

Fork teams building for developer audiences (the primary audience of this template) need GitHub as the baseline second provider. Modern SaaS starters (create-t3-app, next-saas-starter, Vercel's official template) all ship Google + GitHub as the minimum social pair.

`.env.example` has `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` but no GitHub equivalents. The Connected Accounts tab in Settings shows only the Google slot.

## Solution

1. Add `GitHub` provider to `lib/auth.ts` alongside `Google`
2. Add `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` to `.env.example` with setup comment
3. Update the Settings Connected Accounts tab to show both providers (Google + GitHub)
4. Update the auth split-screen UI (`app/(auth)/`) to show a GitHub button
5. Document the GitHub OAuth app setup steps in `.env.example` comments

No DB migration required — the schema already supports multi-provider.

## Key Files

- `next-app/lib/auth.ts` — add `GitHub` provider
- `next-app/.env.example` — add `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`
- `next-app/app/(auth)/login/page.tsx` — add GitHub login button
- `next-app/app/(auth)/register/page.tsx` — add GitHub register button
- `next-app/app/(dashboard)/dashboard/settings/_settings-tabs.tsx` — connected accounts tab
- `next-app/lib/auth-utils.ts` (if needed) — provider name → icon mapping

## Implementation

### Phase 1 — Provider wiring
- Import `GitHub` from `next-auth/providers/github`
- Add to `providers` array in `auth.ts` with `clientId: env.AUTH_GITHUB_ID`, `clientSecret: env.AUTH_GITHUB_SECRET`
- Add env vars to `.env.example` with setup instructions

### Phase 2 — Auth UI
- Add GitHub button to login + register pages (same style as Google button)
- Use Lucide `Github` icon or inline SVG
- Test: clicking GitHub button initiates OAuth flow (requires real env vars in dev)

### Phase 3 — Settings Connected Accounts tab
- Show both Google and GitHub connection status
- "Connect" / "Disconnect" per provider
- If only one provider connected and no password set, disable Disconnect (prevent lockout)

## Acceptance Criteria

- [ ] GitHub provider configured in `lib/auth.ts`
- [ ] GitHub login/register buttons appear on auth pages
- [ ] Connected Accounts tab shows GitHub alongside Google
- [ ] `.env.example` has `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` with setup comment
- [ ] `pnpm typecheck` + `pnpm build` pass
- [ ] No regressions to Google OAuth or credentials login

## Out of Scope

- Additional providers (Twitter/X, LinkedIn, Discord)
- Provider-specific profile data sync beyond what NextAuth provides
- Account merging (two social logins linking to one account)
