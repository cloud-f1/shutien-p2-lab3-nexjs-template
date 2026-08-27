/**
 * E355 — unit tests for the PURE decision layer of the persistent login lockout
 * (lib/auth-utils.ts). No database, no NextAuth — just the count/lock arithmetic
 * and the feature-flag parsing.
 *
 * The wiring half ("does the real login path actually call these?") lives in
 * lib/auth.test.ts (path 1: non-2FA users) and actions/auth.test.ts (path 2: the
 * 2FA branch of loginAction). A tested pure function with no caller is a known
 * failure mode in this repo — both halves are required.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ACCOUNT_LOCKED_MESSAGE,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  clearedLoginState,
  hasLoginFailuresToClear,
  isLocked,
  isLockoutEnabled,
  nextFailedState,
  providerLabel,
} from "./auth-utils"

const NOW = new Date("2026-08-27T12:00:00.000Z")

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// isLockoutEnabled — Acceptance #9
// ---------------------------------------------------------------------------

describe("isLockoutEnabled", () => {
  it("defaults to TRUE when the env var is not set (secure by default)", () => {
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", undefined)
    expect(isLockoutEnabled()).toBe(true)
    // explicit undefined argument behaves the same
    expect(isLockoutEnabled(undefined)).toBe(true)
  })

  it.each(["false", "0", "off", "FALSE", "Off", "  false  "])(
    "treats %j as disabled",
    (raw) => {
      expect(isLockoutEnabled(raw)).toBe(false)
    },
  )

  it.each(["true", "1", "on", "TRUE", "yes", "anything-else", ""])(
    "treats %j as enabled",
    (raw) => {
      expect(isLockoutEnabled(raw)).toBe(true)
    },
  )

  it("reads process.env.ENABLE_LOGIN_LOCKOUT when no argument is given", () => {
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "false")
    expect(isLockoutEnabled()).toBe(false)
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "true")
    expect(isLockoutEnabled()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// isLocked — Acceptance #1 (gate), #4 (expiry), #6 (null user), #8 (escape hatch)
// ---------------------------------------------------------------------------

describe("isLocked", () => {
  it("returns false for a null / undefined user", () => {
    expect(isLocked(null, NOW)).toBe(false)
    expect(isLocked(undefined, NOW)).toBe(false)
  })

  it("returns false when lockedUntil is null (never locked)", () => {
    expect(isLocked({ failedLoginCount: 3, lockedUntil: null }, NOW)).toBe(false)
  })

  it("returns TRUE while lockedUntil is in the future", () => {
    const lockedUntil = new Date(NOW.getTime() + 60_000)
    expect(isLocked({ failedLoginCount: 5, lockedUntil }, NOW)).toBe(true)
  })

  it("returns false once lockedUntil has passed", () => {
    const lockedUntil = new Date(NOW.getTime() - 1)
    expect(isLocked({ failedLoginCount: 5, lockedUntil }, NOW)).toBe(false)
  })

  it("treats the exact expiry instant as NOT locked (boundary)", () => {
    expect(isLocked({ failedLoginCount: 5, lockedUntil: new Date(NOW) }, NOW)).toBe(false)
  })

  // Acceptance #8 — the escape hatch. Disabling the flag must also release an
  // ALREADY-persisted lock, otherwise the switch does nothing for the one
  // scenario an operator reaches for it in.
  it("ignores an existing future lockedUntil when the flag is disabled", () => {
    const lockedUntil = new Date(NOW.getTime() + 15 * 60 * 1000)
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "false")
    expect(isLocked({ failedLoginCount: 5, lockedUntil }, NOW)).toBe(false)
    // …and the original semantics come back when it is re-enabled.
    vi.stubEnv("ENABLE_LOGIN_LOCKOUT", "true")
    expect(isLocked({ failedLoginCount: 5, lockedUntil }, NOW)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// nextFailedState — Acceptance #1, #4, #6
// ---------------------------------------------------------------------------

describe("nextFailedState", () => {
  it("starts the counter at 1 for a user with no prior failures", () => {
    expect(nextFailedState({ failedLoginCount: 0, lockedUntil: null }, NOW)).toEqual({
      failedLoginCount: 1,
      lockedUntil: null,
    })
  })

  it("tolerates a null / undefined user (counts as the first failure)", () => {
    expect(nextFailedState(null, NOW)).toEqual({ failedLoginCount: 1, lockedUntil: null })
    expect(nextFailedState(undefined, NOW)).toEqual({ failedLoginCount: 1, lockedUntil: null })
  })

  it("does NOT lock on the 4th consecutive failure (boundary below the threshold)", () => {
    const res = nextFailedState({ failedLoginCount: 3, lockedUntil: null }, NOW)
    expect(res.failedLoginCount).toBe(4)
    expect(res.failedLoginCount).toBeLessThan(MAX_FAILED_LOGIN_ATTEMPTS)
    expect(res.lockedUntil).toBeNull()
  })

  it("locks ON the 5th consecutive failure, for exactly LOCKOUT_DURATION_MS", () => {
    const res = nextFailedState(
      { failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS - 1, lockedUntil: null },
      NOW,
    )
    expect(res.failedLoginCount).toBe(MAX_FAILED_LOGIN_ATTEMPTS)
    expect(res.lockedUntil).toBeInstanceOf(Date)
    // Asserted against a literal, NOT by re-deriving it from LOCKOUT_DURATION_MS
    // alone — 12:00:00Z + 15 min = 12:15:00Z.
    expect(res.lockedUntil?.toISOString()).toBe("2026-08-27T12:15:00.000Z")
    expect(res.lockedUntil!.getTime() - NOW.getTime()).toBe(LOCKOUT_DURATION_MS)
  })

  it("re-locks a still-locked account and keeps counting (count 5 → 6)", () => {
    const lockedUntil = new Date(NOW.getTime() + 60_000)
    const res = nextFailedState({ failedLoginCount: 5, lockedUntil }, NOW)
    expect(res.failedLoginCount).toBe(6)
    expect(res.lockedUntil?.toISOString()).toBe("2026-08-27T12:15:00.000Z")
  })

  // Acceptance #4 — after the window passes, the user gets a FULL fresh set of
  // attempts; a single miss must not immediately re-lock them.
  it("restarts the counter from scratch once a prior lock has EXPIRED", () => {
    const expired = new Date(NOW.getTime() - 1000)
    const res = nextFailedState({ failedLoginCount: 5, lockedUntil: expired }, NOW)
    expect(res.failedLoginCount).toBe(1) // NOT 6 — count restarts
    expect(res.lockedUntil).toBeNull() // NOT immediately re-locked
  })

  it("needs a full 5 fresh failures to lock again after an expired window", () => {
    const expired = new Date(NOW.getTime() - 1000)
    let state: { failedLoginCount: number; lockedUntil: Date | null } = {
      failedLoginCount: 5,
      lockedUntil: expired,
    }
    const locks: (Date | null)[] = []
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      state = nextFailedState(state, NOW)
      locks.push(state.lockedUntil)
    }
    expect(locks.slice(0, 4)).toEqual([null, null, null, null])
    expect(state.failedLoginCount).toBe(MAX_FAILED_LOGIN_ATTEMPTS)
    expect(locks[4]).toBeInstanceOf(Date)
  })

  it("treats a null failedLoginCount as 0", () => {
    expect(nextFailedState({ failedLoginCount: null, lockedUntil: null }, NOW)).toEqual({
      failedLoginCount: 1,
      lockedUntil: null,
    })
  })
})

// ---------------------------------------------------------------------------
// clearedLoginState / hasLoginFailuresToClear — Acceptance #3
// ---------------------------------------------------------------------------

describe("clearedLoginState", () => {
  it("zeroes the counter and drops the lock", () => {
    expect(clearedLoginState()).toEqual({ failedLoginCount: 0, lockedUntil: null })
  })
})

describe("hasLoginFailuresToClear", () => {
  it("is false for a clean user (nothing to write)", () => {
    expect(hasLoginFailuresToClear({ failedLoginCount: 0, lockedUntil: null })).toBe(false)
    expect(hasLoginFailuresToClear({ failedLoginCount: null, lockedUntil: null })).toBe(false)
    expect(hasLoginFailuresToClear(null)).toBe(false)
  })

  it("is true when a counter or a lock is present", () => {
    expect(hasLoginFailuresToClear({ failedLoginCount: 1, lockedUntil: null })).toBe(true)
    expect(hasLoginFailuresToClear({ failedLoginCount: 0, lockedUntil: NOW })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Pre-existing exports — guard against the new block clobbering them.
// ---------------------------------------------------------------------------

describe("providerLabel (pre-existing)", () => {
  it("maps known provider ids and title-cases unknown ones", () => {
    expect(providerLabel("google")).toBe("Google")
    expect(providerLabel("GitHub")).toBe("GitHub")
    expect(providerLabel("okta")).toBe("Okta")
  })
})

describe("ACCOUNT_LOCKED_MESSAGE", () => {
  it("is a 繁體中文 message that mentions the 15-minute window", () => {
    expect(ACCOUNT_LOCKED_MESSAGE).toContain("鎖定")
    expect(ACCOUNT_LOCKED_MESSAGE).toContain("15")
  })
})
