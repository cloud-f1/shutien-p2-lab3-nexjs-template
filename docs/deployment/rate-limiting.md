# Rate Limiting — In-Memory → Redis/Upstash Migration

> Phase 69 · E298 · Server-Side Rate Limiting
> Code: `next-app/lib/rate-limit.ts`

## What ships today

The template uses an **in-memory, single-process** rate limiter
(`next-app/lib/rate-limit.ts`). It is a plain `Map<string, Bucket>` with a
fixed-window algorithm. Every authenticated mutation Server Action consumes one
hit against a **per-user bucket** keyed on `session.user.id`, plus the auth
flows (login / email / password reset) which use per-email and per-IP buckets.

### Where it is wired (E298)

| File | Action | Bucket key | Limit |
|------|--------|------------|-------|
| `actions/api-keys.ts` | `createApiKey` | `apikey:create:${userId}` | 10 / min |
| | `revokeApiKey` | `apikey:revoke:${userId}` | 10 / min |
| `actions/webhooks.ts` | `createWebhook` | `webhook:create:${userId}` | 10 / min |
| | `setWebhookActive` | `webhook:toggle:${userId}` | 10 / min |
| | `deleteWebhook` | `webhook:delete:${userId}` | 10 / min |
| | `sendTestEvent` | `webhook:test:${userId}` | **3 / min** (tight — outbound HTTP) |
| `actions/team.ts` | `inviteMember` | `team:invite:${userId}` | **5 / hour** (anti-spam) |
| | `revokeInvitation` | `team:revoke:${userId}` | 20 / min |
| | `acceptInvitation` | `team:accept:${userId}` | 10 / min |
| `actions/user.ts` | `updateProfile` | `user:profile:${userId}` | 10 / min |
| | `changePassword` | `user:password:${userId}` | **3 / hour** (anti-brute-force) |
| `actions/admin.ts` | `setUserRole` | `admin:role:${userId}` | 20 / min |
| | `deleteUser` | `admin:delete:${userId}` | 20 / min |

The shared helper is `rateLimitGuard(key, limit, windowMs)`: it consumes one hit
and returns a ready-to-return `{ error }` result when the window is exhausted,
or `null` to let the action proceed. The message is intentionally generic so it
never leaks the limit or bucket key.

## Why you must replace it before scaling horizontally

The in-memory limiter has two hard limitations that are **fine for a single
container** but break in production-at-scale:

1. **State is lost on restart / redeploy.** Every cold start resets all buckets.
2. **State is NOT shared across replicas.** With N serverless instances (Vercel,
   Zeabur autoscaling, Cloud Run min-instances > 1, Kubernetes replicas), each
   process keeps its own `Map`. An attacker effectively gets `N × limit`
   requests, and the same user can be rate-limited inconsistently depending on
   which replica routed the request.

If you deploy as a **single always-on container** (the default Zeabur
single-service setup), the in-memory limiter is adequate. The moment you set
replicas > 1 or move to a serverless/edge platform, migrate to a shared store.

## Migration path — Upstash (`@upstash/ratelimit` + Upstash Redis)

[Upstash](https://upstash.com) is the lowest-friction option: serverless Redis
over HTTP (works from edge/serverless), with an official sliding-window limiter.

### 1. Install

```bash
pnpm add @upstash/ratelimit @upstash/redis
```

### 2. Env vars (set in your platform; do NOT prefix with `NEXT_PUBLIC_`)

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

These are **runtime, server-only** secrets — never expose them to the client.

### 3. Drop-in replacement for `rateLimitGuard`

Keep the same call sites; only swap the implementation in `lib/rate-limit.ts`.
Because Upstash's API is async, `rateLimitGuard` becomes `async` and the action
call sites change from `const limited = rateLimitGuard(...)` to
`const limited = await rateLimitGuard(...)`.

```ts
// lib/rate-limit.ts (Upstash variant)
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv() // reads UPSTASH_REDIS_REST_URL / _TOKEN

// One limiter per (limit, window) tuple — cache so we reuse the analytics conn.
const limiters = new Map<string, Ratelimit>()
function getLimiter(limit: number, windowMs: number): Ratelimit {
  const k = `${limit}:${windowMs}`
  let l = limiters.get(k)
  if (!l) {
    l = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: "rl",
    })
    limiters.set(k, l)
  }
  return l
}

export async function rateLimitGuard(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ error: string } | null> {
  const { success, reset } = await getLimiter(limit, windowMs).limit(key)
  if (success) return null
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000))
  return { error: `請求過於頻繁，請於 ${retryAfter} 秒後再試。` }
}
```

> The bucket keys (`apikey:create:${userId}`, etc.) are already
> instance-agnostic — they contain no process-local state — so no call site
> needs new key logic, only the `await`.

### 4. Update call sites

Search for `rateLimitGuard(` across `actions/` and prefix each with `await`
(they are already inside `async` Server Actions, so this is mechanical).

## Alternatives

- **Self-hosted Redis** (e.g. Zeabur Redis service): use a TCP Redis client
  (`ioredis`) instead of the Upstash REST client; the same sliding-window logic
  applies. Note: TCP Redis does not work from edge runtimes.
- **Edge KV** (Vercel KV, Cloudflare KV/Durable Objects): viable for
  edge-deployed apps; Durable Objects give the strongest consistency for
  counters.

## Out of scope (per E298)

- Route-handler rate limiting for the `/api/v1/*` REST endpoints (separate
  concern — those already authenticate via API keys).
- Edge-middleware / infra-layer (WAF) rate limiting — deploy-specific.
