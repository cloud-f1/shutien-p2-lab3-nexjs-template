/**
 * Pure plan-identity (FK) resolution helpers (E274) — NO db import, unit-testable
 * WITHOUT a DATABASE_URL.
 *
 * THE FK PROBLEM
 * --------------
 * `config/pricing.json` tiers carry a `providerPriceId` (Stripe price_xxx / ECPay
 * PlanID). But `subscriptions.planId` is a UUID FK → `plans.id`. So:
 *
 *   - checkout must resolve the `plans` row by `providerPriceId` and carry the
 *     plan UUID in the gateway session metadata (`metadata.planId`).
 *   - webhooks must write THAT UUID into `subscriptions.planId` — never the
 *     `providerPriceId` string (which would violate the FK / be a malformed UUID).
 *
 * The DB lookup/insert lives in `lib/billing/plans.ts`; the pure decision logic
 * (is this a UUID? which config tier backs this priceId? what plan row should we
 * insert?) lives here so it is testable without a database.
 */

import type { NewPlan } from "@/lib/schema/billing"
import { PRICING_CURRENCY, getTierByPriceId, type PricingTier } from "@/lib/billing/pricing"

// ---------------------------------------------------------------------------
// UUID guard — distinguish a real plans.id from a providerPriceId string
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** True iff the value is a canonical v1–v5 UUID (i.e. a real plans.id, not a price id). */
export function isUuid(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_RE.test(value)
}

// ---------------------------------------------------------------------------
// Build the plans-row insert values from a config tier
// ---------------------------------------------------------------------------

/**
 * Map a config pricing tier → the `plans` insert row. Amount is stored in the
 * smallest currency unit (cents): config carries dollars, so we ×100.
 *
 * @throws if the tier has no providerPriceId (free tier is not purchasable).
 */
export function planRowFromTier(tier: PricingTier): NewPlan {
  if (!tier.providerPriceId) {
    throw new Error(`Tier "${tier.slug}" has no providerPriceId — not purchasable.`)
  }
  return {
    providerPriceId: tier.providerPriceId,
    interval: tier.interval,
    amount: Math.round(tier.monthlyPrice * 100),
    currency: PRICING_CURRENCY,
    active: true,
  }
}

/**
 * Build the `plans` insert row directly from a providerPriceId by looking the
 * tier up in `config/pricing.json`. Returns null when the price id is unknown to
 * config (caller should treat as an invalid checkout).
 */
export function planRowFromPriceId(providerPriceId: string): NewPlan | null {
  const tier = getTierByPriceId(providerPriceId)
  if (!tier) return null
  return planRowFromTier(tier)
}

// ---------------------------------------------------------------------------
// Resolve a plan UUID from a set of already-loaded plans rows
// ---------------------------------------------------------------------------

/** Minimal shape of a plans row needed to resolve the FK. */
export interface PlanIdRow {
  id: string
  providerPriceId: string
}

/**
 * Given the plans rows already loaded from the DB, find the UUID that backs a
 * providerPriceId. Returns null when no row matches (caller must create it).
 */
export function resolvePlanUuid(
  rows: PlanIdRow[],
  providerPriceId: string,
): string | null {
  const hit = rows.find((r) => r.providerPriceId === providerPriceId)
  return hit?.id ?? null
}

/**
 * Coerce a metadata `planId` to a real plans UUID.
 *
 * Webhooks receive whatever checkout stamped into `metadata.planId`. The fixed
 * checkout stamps the UUID, but to stay robust against older/in-flight sessions
 * that stamped a providerPriceId, this resolves a non-UUID value back to the
 * plan UUID via the loaded rows. Returns null when it cannot resolve to a UUID.
 */
export function coercePlanUuid(
  metadataPlanId: string | null | undefined,
  rows: PlanIdRow[],
): string | null {
  if (!metadataPlanId) return null
  if (isUuid(metadataPlanId)) return metadataPlanId
  // Legacy / fallback: metadata carried a providerPriceId — map it to the UUID.
  return resolvePlanUuid(rows, metadataPlanId)
}
