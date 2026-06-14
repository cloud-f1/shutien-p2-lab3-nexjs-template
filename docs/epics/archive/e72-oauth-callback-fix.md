# E72 — OAuth Callback Flow Fix

> **Phase**: 22 | **Size**: M (8 SP) | **Priority**: P0
> **Depends on**: none
> **Branch**: `feat/E72-oauth-callback-fix`

---

## Problem Statement

The OAuth flow is half-implemented. fastapi-users' `BearerTransport` returns JSON from the callback endpoint, but the callback is a browser redirect from Google/GitHub — so the user sees raw JSON and is stuck. The SPA has no way to capture the token.

Additionally:
- OAuth callback returns only `access_token` (no refresh token, no session record)
- GitHub button missing on client
- No client-side callback page to handle the redirect

## Solution

### Server: Custom OAuth callback wrapper
Replace the default fastapi-users callback with a custom endpoint that:
1. Performs the same OAuth code exchange + user creation
2. Creates a session record (like custom login does)
3. Generates both access + refresh tokens
4. **Redirects the browser** to `{ALLOWED_ORIGINS[0]}/auth/callback#access_token=...&refresh_token=...`

### Client: OAuth callback page
Create `/auth/callback` route that:
1. Reads tokens from URL hash fragment
2. Stores access token in memory (`setAccessToken`)
3. Stores refresh token (cookie or memory)
4. Updates auth store
5. Redirects to `/dashboard`

### Client: GitHub button
Add GitHub OAuth button to SocialButtons + `getGithubAuthUrl()` in auth API.

## Stories

### S1: Server — Custom OAuth Callback

**AC**:
- [ ] Custom callback endpoint for Google at `/auth/google/callback`
- [ ] Custom callback endpoint for GitHub at `/auth/github/callback`
- [ ] Exchanges auth code via httpx-oauth client (same as fastapi-users)
- [ ] Validates CSRF state token from cookie
- [ ] Calls `user_manager.oauth_callback()` to create/associate user
- [ ] Creates session record in DB (like custom login in auth.py)
- [ ] Generates access token (15 min) + refresh token (30 days)
- [ ] Redirects browser to: `{ALLOWED_ORIGINS[0]}/auth/callback#access_token={at}&refresh_token={rt}`
- [ ] Error cases redirect to: `{ALLOWED_ORIGINS[0]}/signin?error=oauth_failed`

### S2: Client — OAuth Callback Page

**AC**:
- [ ] New `OAuthCallbackPage` at `client/src/pages/auth/OAuthCallbackPage.tsx`
- [ ] Route `/auth/callback` added to App.tsx
- [ ] Reads `access_token` and `refresh_token` from URL hash fragment
- [ ] Calls `setAccessToken()` + stores refresh token
- [ ] Fetches current user and updates auth store
- [ ] Redirects to `/dashboard` on success
- [ ] Redirects to `/signin` with error banner on failure
- [ ] Loading spinner while processing
- [ ] Cleans URL hash after extracting tokens (security)

### S3: Client — GitHub OAuth Button

**AC**:
- [ ] `getGithubAuthUrl()` added to `client/src/api/auth.ts`
- [ ] GitHub button added to `SocialButtons.tsx` (conditionally rendered if `VITE_GITHUB_CLIENT_ID` is set, or always shown)
- [ ] GitHub icon/branding on the button
- [ ] Same flow as Google: fetch authorize URL → redirect

### S4: OpenAPI Spec Update

**AC**:
- [ ] `docs/openapi.yaml` updated with custom callback endpoints
- [ ] Callback response documented as 302 redirect (not JSON)
- [ ] Error response documented

### S5: Tests

**AC**:
- [ ] Server: test custom callback returns 302 redirect with tokens in fragment
- [ ] Server: test callback creates session record
- [ ] Server: test callback with invalid code returns error redirect
- [ ] Server: test CSRF validation
- [ ] Client: test OAuthCallbackPage extracts tokens and redirects
- [ ] Client: test OAuthCallbackPage handles missing/invalid tokens
- [ ] Client: test SocialButtons renders both Google and GitHub buttons
- [ ] Coverage gates pass (server >= 90%, client >= 80%)

## Risk Notes

- **CSRF cookie SameSite**: The `fapiuser:csrf` cookie is set on the API domain. If API and client are on different domains (production), the cookie won't be sent back. May need `SameSite=None; Secure` or a custom CSRF approach.
- **URL hash vs query params**: Hash fragments (`#`) are never sent to the server — safer for tokens. But some older browsers may not handle them well.
- **Refresh token in URL**: Even in hash fragment, refresh tokens in URLs are a security concern. Alternative: set refresh token as httpOnly cookie in the redirect response.
- **fastapi-users upgrade risk**: Custom callback bypasses fastapi-users' built-in OAuth router for the callback step. Future upgrades may change the internal API.
