/**
 * Pure countdown-timer helpers (E326). No DOM/React — kept isolated so the
 * "ticking" logic can be unit-tested without mounting the client component.
 */

export interface RemainingTime {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** True once `now >= deadline`. Callers should hide the countdown, not reset it. */
  expired: boolean
}

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * Compute the remaining time until `deadline`. Never returns negative
 * components — once expired, all fields clamp to 0 and `expired` is true.
 */
export function getRemainingTime(deadline: string | Date, now: Date | string = new Date()): RemainingTime {
  const deadlineMs = new Date(deadline).getTime()
  const nowMs = new Date(now).getTime()
  const diff = deadlineMs - nowMs

  if (!Number.isFinite(deadlineMs) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  }

  return {
    days: Math.floor(diff / DAY_MS),
    hours: Math.floor((diff % DAY_MS) / HOUR_MS),
    minutes: Math.floor((diff % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((diff % MINUTE_MS) / SECOND_MS),
    expired: false,
  }
}

/** Zero-padded "DD:HH:MM:SS" style segment, for compact display. */
export function padSegment(value: number): string {
  return String(Math.max(0, value)).padStart(2, "0")
}
