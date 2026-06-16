/**
 * Pure reconcile diffing (E274) — NO db / SDK import, unit-testable WITHOUT a
 * DATABASE_URL.
 *
 * reconcile() catches drift left by a missed webhook: it compares the gateway's
 * ground-truth subscription state against the row stored in `subscriptions` and
 * decides what to repair. The DB I/O + gateway fetch live in the route handler /
 * provider; the DECISION (does this row need an update, and to what) is pure and
 * tested here.
 */

import type { SubscriptionStatus } from "@/lib/billing/provider"

/** The subset of a stored subscription row reconcile compares against. */
export interface StoredSubState {
  providerSubId: string
  status: SubscriptionStatus
  currentPeriodEnd: Date | null
  cancelAt: Date | null
}

/** The gateway's ground-truth view of the same subscription. */
export interface GatewaySubState {
  providerSubId: string
  status: SubscriptionStatus
  /** unix-seconds epoch, or null. */
  currentPeriodEnd: number | null
  /** unix-seconds epoch, or null. */
  cancelAt: number | null
}

/** What a single reconcile decision yields. */
export interface ReconcileDecision {
  providerSubId: string
  needsUpdate: boolean
  /** The fields that drifted, ready to write (only present when needsUpdate). */
  patch?: {
    status?: SubscriptionStatus
    currentPeriodEnd?: Date | null
    cancelAt?: Date | null
  }
  /** Human-readable reasons (for audit/logging). */
  reasons: string[]
}

function sameEpochDate(stored: Date | null, epoch: number | null): boolean {
  if (stored === null && epoch === null) return true
  if (stored === null || epoch === null) return false
  // Compare at second granularity (DB stores ms, gateway gives seconds).
  return Math.floor(stored.getTime() / 1000) === epoch
}

/**
 * Diff one stored row against the gateway truth. Pure — returns the decision
 * (and the exact patch) without touching the DB.
 */
export function diffSubscription(
  stored: StoredSubState,
  gateway: GatewaySubState,
): ReconcileDecision {
  const reasons: string[] = []
  const patch: NonNullable<ReconcileDecision["patch"]> = {}

  if (stored.status !== gateway.status) {
    reasons.push(`status ${stored.status} → ${gateway.status}`)
    patch.status = gateway.status
  }

  if (!sameEpochDate(stored.currentPeriodEnd, gateway.currentPeriodEnd)) {
    reasons.push("current_period_end drifted")
    patch.currentPeriodEnd =
      gateway.currentPeriodEnd === null ? null : new Date(gateway.currentPeriodEnd * 1000)
  }

  if (!sameEpochDate(stored.cancelAt, gateway.cancelAt)) {
    reasons.push("cancel_at drifted")
    patch.cancelAt = gateway.cancelAt === null ? null : new Date(gateway.cancelAt * 1000)
  }

  const needsUpdate = reasons.length > 0
  return {
    providerSubId: stored.providerSubId,
    needsUpdate,
    ...(needsUpdate ? { patch } : {}),
    reasons,
  }
}

/** Aggregate reconcile counts over a batch of decisions. */
export interface ReconcileSummary {
  checked: number
  updated: number
  decisions: ReconcileDecision[]
}

/**
 * Reconcile a batch by pairing stored rows (keyed by providerSubId) with the
 * gateway states. Rows present in the gateway but missing locally, and rows
 * present locally but missing from the gateway snapshot, are reported but not
 * auto-patched here (the caller decides recovery policy).
 */
export function reconcileBatch(
  stored: StoredSubState[],
  gateway: GatewaySubState[],
): ReconcileSummary {
  const gatewayById = new Map(gateway.map((g) => [g.providerSubId, g]))
  const decisions: ReconcileDecision[] = []
  let updated = 0

  for (const row of stored) {
    const g = gatewayById.get(row.providerSubId)
    if (!g) {
      decisions.push({
        providerSubId: row.providerSubId,
        needsUpdate: false,
        reasons: ["not found in gateway snapshot — skipped"],
      })
      continue
    }
    const decision = diffSubscription(row, g)
    if (decision.needsUpdate) updated++
    decisions.push(decision)
  }

  return { checked: stored.length, updated, decisions }
}
