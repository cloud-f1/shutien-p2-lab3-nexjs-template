// E298 — unit tests for the in-memory rate limiter + the rateLimitGuard()
// Server-Action helper. Fully db-free: exercises the pure bucket logic and the
// guard's bail behaviour, resetting state via __resetRateLimit() between cases.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  __resetRateLimit,
  cooldown,
  isRateLimited,
  rateLimit,
  rateLimitGuard,
  recordFailure,
} from "./rate-limit"

const MINUTE_MS = 60_000

beforeEach(() => {
  __resetRateLimit()
})

afterEach(() => {
  // Scoped restore so fake timers used by one test (below) never leak into
  // sibling tests in this file or other files in the same worker (E360).
  vi.useRealTimers()
})

describe("rateLimit", () => {
  it("allows up to `limit` hits, then blocks within the window", () => {
    const key = "rl:test"
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, MINUTE_MS).ok).toBe(true)
    }
    const blocked = rateLimit(key, 3, MINUTE_MS)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it("scopes buckets per key (one user's spend doesn't affect another)", () => {
    expect(rateLimit("user:a", 1, MINUTE_MS).ok).toBe(true)
    expect(rateLimit("user:a", 1, MINUTE_MS).ok).toBe(false)
    // Different key → fresh budget.
    expect(rateLimit("user:b", 1, MINUTE_MS).ok).toBe(true)
  })

  it("resets the window after it expires", () => {
    vi.useFakeTimers()
    const key = "rl:window"
    expect(rateLimit(key, 1, MINUTE_MS).ok).toBe(true)
    expect(rateLimit(key, 1, MINUTE_MS).ok).toBe(false)
    // Deterministically advance past the window's expiry — no real wall-clock
    // wait, no boundary race (was: a real 1ms window + real setTimeout, flaky
    // whenever the two calls straddled a millisecond tick — see E360). The
    // top-level afterEach() restores real timers even if an assertion throws.
    vi.advanceTimersByTime(MINUTE_MS + 1)
    expect(rateLimit(key, 1, MINUTE_MS).ok).toBe(true)
  })
})

describe("rateLimitGuard", () => {
  it("returns null while under the limit", () => {
    expect(rateLimitGuard("guard:ok", 2, MINUTE_MS)).toBeNull()
    expect(rateLimitGuard("guard:ok", 2, MINUTE_MS)).toBeNull()
  })

  it("returns an { error } result once the limit is exceeded", () => {
    const key = "guard:limited"
    rateLimitGuard(key, 1, MINUTE_MS) // consume the only hit
    const result = rateLimitGuard(key, 1, MINUTE_MS)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty("error")
    expect(typeof result?.error).toBe("string")
    expect(result?.error.length).toBeGreaterThan(0)
  })

  it("does not leak the bucket key or numeric limit in the message", () => {
    const key = "guard:secret-key"
    rateLimitGuard(key, 1, MINUTE_MS)
    const result = rateLimitGuard(key, 1, MINUTE_MS)
    expect(result?.error).not.toContain(key)
    expect(result?.error).not.toContain("1")
  })

  it("models the per-action limits used by the action files", () => {
    // api-keys create: 10/min
    for (let i = 0; i < 10; i++) {
      expect(rateLimitGuard("apikey:create:u1", 10, MINUTE_MS)).toBeNull()
    }
    expect(rateLimitGuard("apikey:create:u1", 10, MINUTE_MS)).not.toBeNull()

    // webhook test: tighter 3/min
    for (let i = 0; i < 3; i++) {
      expect(rateLimitGuard("webhook:test:u1", 3, MINUTE_MS)).toBeNull()
    }
    expect(rateLimitGuard("webhook:test:u1", 3, MINUTE_MS)).not.toBeNull()

    // changePassword: 3/hour
    for (let i = 0; i < 3; i++) {
      expect(rateLimitGuard("user:password:u1", 3, 60 * MINUTE_MS)).toBeNull()
    }
    expect(rateLimitGuard("user:password:u1", 3, 60 * MINUTE_MS)).not.toBeNull()
  })
})

describe("isRateLimited / recordFailure", () => {
  it("only counts recorded failures (read-only check never consumes)", () => {
    const key = "fail:test"
    expect(isRateLimited(key, 2).ok).toBe(true)
    expect(isRateLimited(key, 2).ok).toBe(true) // still ok — no hits consumed
    recordFailure(key, MINUTE_MS)
    recordFailure(key, MINUTE_MS)
    expect(isRateLimited(key, 2).ok).toBe(false)
  })
})

describe("cooldown", () => {
  it("allows one action then blocks until the cooldown elapses", () => {
    const key = "cool:test"
    expect(cooldown(key, MINUTE_MS).ok).toBe(true)
    const blocked = cooldown(key, MINUTE_MS)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })
})
