// Lightweight in-memory rate limiter for the template.
//
// NOTE: this is a single-process Map — state is lost on restart and is NOT shared
// across serverless instances or horizontally-scaled replicas. It is "good enough"
// to blunt casual brute-force / email-bombing for a starter template. For real
// production traffic, back this with Redis (e.g. Upstash) or an edge KV store.
//
// Migration path (in-memory → Redis/Upstash) for fork teams scaling horizontally:
//   docs/deployment/rate-limiting.md

type Bucket = {
  count: number
  resetAt: number // epoch ms when the window expires
  /** E375 — has this window already been reported? Keeps the log to one line
   *  per bucket per window instead of one per blocked request. */
  reported?: boolean
}

/**
 * E375 — observability for a control that was previously entirely silent.
 *
 * `rateLimitGuard` returned an error string and recorded NOTHING. After E370
 * that string can be the only thing standing between a real buyer and a
 * checkout, and the operator of a fork had no way to see it happening: the
 * buyer sees "請求過於頻繁", the operator sees conversion drop, and nothing
 * connects the two. The failure mode is silent lost revenue.
 *
 * Written to the server log rather than `audit_log` ON PURPOSE. A DB write per
 * blocked request would make the throttle its own amplifier — the endpoint an
 * attacker is hammering would generate a row per hit, which is the shape of
 * problem E356 refused for login events. One line per bucket per window is
 * enough to answer "is this firing, and how often".
 *
 * The key is NOT logged. Keys embed the subject — a user id, or a client IP —
 * and a throttle that transcribes every blocked visitor's IP into the logs is a
 * visitor-tracking table nobody consented to. Only the PREFIX (everything
 * before the final `:`) is emitted, which is the part that identifies the
 * endpoint rather than the person.
 */
function keyPrefix(key: string): string {
  const i = key.lastIndexOf(":")
  return i === -1 ? key : key.slice(0, i)
}

function reportThrottle(key: string, limit: number, windowMs: number, count: number) {
  console.warn(
    JSON.stringify({
      event: "rate_limit.blocked",
      scope: keyPrefix(key),
      limit,
      windowMs,
      observed: count,
    }),
  )
}

const buckets = new Map<string, Bucket>()

// Best-effort cleanup so the Map doesn't grow unbounded in a long-lived process.
function sweep(now: number) {
  if (buckets.size < 5000) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = {
  /** true when the request is allowed (under the limit). */
  ok: boolean
  /** seconds the caller should wait before retrying (0 when ok). */
  retryAfter: number
}

/**
 * Fixed-window rate limiter. Counts each call against the window.
 *
 * @param key     unique bucket key (e.g. `login:${email}` or `login:ip:${ip}`)
 * @param limit   max allowed hits per window
 * @param windowMs window length in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (bucket.count >= limit) {
    // E375 — report the TRANSITION, once per bucket per window.
    if (!bucket.reported) {
      bucket.reported = true
      reportThrottle(key, limit, windowMs, bucket.count)
    }
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count += 1
  return { ok: true, retryAfter: 0 }
}

/**
 * Read-only check: is `key` currently over `limit`? Does NOT consume a hit.
 * Pair with recordFailure() to count only *failed* attempts (so a successful
 * login never burns the user's budget).
 */
export function isRateLimited(key: string, limit: number): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) return { ok: true, retryAfter: 0 }
  if (bucket.count >= limit) {
    // E375 — same transition report. This path has no windowMs of its own (the
    // window was set by recordFailure), so report the remaining time instead.
    if (!bucket.reported) {
      bucket.reported = true
      reportThrottle(key, limit, bucket.resetAt - now, bucket.count)
    }
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

/** Record one failed attempt against `key`, opening/extending its window. */
export function recordFailure(key: string, windowMs: number): void {
  const now = Date.now()
  sweep(now)
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  bucket.count += 1
}

/**
 * Simple per-key cooldown: allows one action, then blocks until the cooldown
 * elapses. Returns { ok, retryAfter } like rateLimit().
 */
export function cooldown(key: string, cooldownMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + cooldownMs })
    return { ok: true, retryAfter: 0 }
  }

  return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
}

/**
 * Server-Action guard (E298). Consumes one hit against `key` and, when the
 * window is exhausted, returns a ready-to-return `{ error }` result; otherwise
 * returns `null` so the caller can proceed. Used to rate-limit per-user
 * mutations (keyed on `session.user.id`) across the action files.
 *
 *   const limited = rateLimitGuard(`apikey:create:${userId}`, 10, 60_000)
 *   if (limited) return limited
 *
 * The message is generic ("Too many requests" / 繁中) so it never leaks the
 * limit or the bucket key to a caller.
 */
export function rateLimitGuard(
  key: string,
  limit: number,
  windowMs: number,
): { error: string } | null {
  const { ok, retryAfter } = rateLimit(key, limit, windowMs)
  if (ok) return null
  return { error: `請求過於頻繁，請於 ${retryAfter} 秒後再試。` }
}

/** Test helper — clears all buckets. */
export function __resetRateLimit() {
  buckets.clear()
}

/**
 * Client-IP rate-limit key for endpoints reachable with NO session (E370).
 *
 * A public Server Action has no user id to key on, so without this every
 * anonymous caller shares (or escapes) the limiter. Reads the standard proxy
 * headers; falls back to a single shared bucket when none is present, which is
 * deliberately conservative — an unattributable caller is throttled with all
 * other unattributable callers rather than let through.
 *
 * NOTE: `x-forwarded-for` is client-controllable unless a trusted proxy
 * overwrites it. Zeabur/Cloud Run both do. On a deployment where they do NOT,
 * this degrades to per-attacker-chosen-key throttling — annoying to bypass but
 * not a hard boundary. It is a brake on casual abuse, matching this module's
 * stated posture; a hard boundary needs the Redis/edge-KV backing described in
 * the file header.
 */
export function clientIpKey(headers: {
  get(name: string): string | null
}): string {
  const fwd = headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]!.trim()
  return headers.get("x-real-ip")?.trim() || "unknown-ip"
}
