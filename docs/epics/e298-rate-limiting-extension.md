# E298 — Server-Side Rate Limiting Extension

> Phase 69 · security · OWASP hardening
> Status: ⬜ pending

## Problem

`lib/rate-limit.ts` exists and is already used in `actions/auth.ts` (login + email flows), but 5 mutation-heavy action files have zero rate limiting:

- `actions/api-keys.ts` — `createApiKey`, `revokeApiKey`
- `actions/webhooks.ts` — `createWebhook`, `deleteWebhook`, `testWebhook`
- `actions/team.ts` — `inviteMember`, `removeMember`, `changeRole`
- `actions/user.ts` — `changePassword` (post-auth), `updateProfile`
- `actions/admin.ts` — `changeUserRole`, `deleteUser`, `banUser`

An authenticated attacker who obtains a valid session can spam these endpoints without restriction. This is OWASP A07 (Auth Failures) + A04 (Insecure Design).

`lib/rate-limit.ts` is in-memory and not shared across serverless replicas — this is documented in the file itself. The epic must also add a clear migration note for fork teams scaling horizontally.

## Solution

1. Wire `rateLimit` / `isRateLimited` / `recordFailure` into the 5 action files at the top of each mutation
2. Use per-user buckets (keyed on `session.user.id`) for authenticated endpoints
3. Add per-IP fallback bucket where userId may not be available
4. Document the Redis/Upstash migration path in `docs/deployment/rate-limiting.md`
5. Unit test the rate-limit wiring via the `*-utils.ts` pattern (`__resetRateLimit()` between cases)

> Reuse the exact exported API from `lib/rate-limit.ts` — do NOT invent a new object form.

## Key Files

- `next-app/lib/rate-limit.ts` — existing implementation (read-only reference)
- `next-app/actions/api-keys.ts` — add rate limiting
- `next-app/actions/webhooks.ts` — add rate limiting
- `next-app/actions/team.ts` — add rate limiting
- `next-app/actions/user.ts` — add rate limiting (changePassword, updateProfile)
- `next-app/actions/admin.ts` — add rate limiting (destructive admin ops)
- `docs/deployment/rate-limiting.md` (NEW) — in-memory vs Redis/Upstash migration guide

## Implementation

### Phase 1 — api-keys + webhooks
- `rateLimit(\`apikey:${userId}\`, 10, 60_000)` on create/revoke/delete
- `testWebhook`: tighter limit (`\`webhook-test:${userId}\``, 3/min) to prevent webhook spam
- Unit test: exceeding limit returns `{ error: "Too many requests" }`

### Phase 2 — team + user actions
- `inviteMember`: 5/hour per user (prevent invite spam)
- `changePassword`: 3/hour per user (anti-brute-force on post-auth change)
- `updateProfile`: 10/min per user (lenient)

### Phase 3 — admin actions + migration doc
- `changeUserRole` / `deleteUser` / `banUser`: 20/min per admin user
- Add `docs/deployment/rate-limiting.md` — in-memory vs Redis/Upstash tradeoff + Upstash `@upstash/ratelimit` drop-in snippet
- Add inline comment in `lib/rate-limit.ts` linking to the doc

## Acceptance Criteria

- [ ] All 5 action files have rate limiting on every mutation function
- [ ] Limits are tuned per action (tighter for destructive ops, looser for benign ones)
- [ ] Unit tests verify rate-limit enforcement
- [ ] `docs/deployment/rate-limiting.md` exists with Redis/Upstash migration path
- [ ] `pnpm test` + `pnpm typecheck` + `pnpm build` pass

## Out of Scope

- Redis/Upstash integration (documented, not implemented)
- Route handler rate limiting (API v1 endpoints — separate concern)
- Edge middleware rate limiting (infra-layer, deploy-specific)
