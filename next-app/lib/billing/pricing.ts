/**
 * Pricing tiers — loaded from `config/pricing.json` (E274). This is the SINGLE
 * source of truth: the pricing page, the DB seed (plans table), and checkout all
 * derive from it. To change plans, edit the JSON — never hardcode tiers in code.
 */
import type { BillingInterval } from "@/lib/billing/provider"

// Relative (not @/) so the tsx-run seed resolves it the same as the Next build.
import pricingConfig from "../../config/pricing.json"

export interface PricingTier {
  /** Stable slug (free / pro / scale / …). */
  slug: string
  name: string
  description: string
  /** Monthly price in major currency units (dollars), display + seed source. */
  monthlyPrice: number
  interval: BillingInterval
  /** Gateway price id (Stripe price_xxx / ECPay PlanID); null = free, no purchase. */
  providerPriceId: string | null
  highlighted: boolean
  badge: string | null
  ctaLabel: string
  features: string[]
}

export const PRICING_CURRENCY: string = pricingConfig.currency
export const PRICING_TIERS: PricingTier[] = pricingConfig.tiers as PricingTier[]

/** Paid (purchasable) tiers — those with a providerPriceId. */
export const PAID_TIERS: PricingTier[] = PRICING_TIERS.filter((t) => t.providerPriceId)

export function getTierBySlug(slug: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.slug === slug)
}

export function getTierByPriceId(priceId: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.providerPriceId === priceId)
}
