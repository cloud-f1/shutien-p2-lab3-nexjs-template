// Lightweight in-memory rate limiter for the template.
//
// NOTE: this is a single-process Map — state is lost on restart and is NOT shared
// across serverless instances or horizontally-scaled replicas. It is "good enough"
// to blunt casual brute-force / email-bombing for a starter template. For real
// production traffic, back this with Redis (e.g. Upstash) or an edge KV store.

type Bucket = {
  count: number
  resetAt: number // epoch ms when the window expires
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

/** Test helper — clears all buckets. */
export function __resetRateLimit() {
  buckets.clear()
}
