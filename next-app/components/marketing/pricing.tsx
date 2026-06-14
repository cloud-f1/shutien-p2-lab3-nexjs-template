import Link from "next/link"

import type { Plan } from "@/lib/billing/provider"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// ---------------------------------------------------------------------------
// Static plan display shape (subset of Plan used for display)
// ---------------------------------------------------------------------------

interface PricingTier {
  /** Maps to Plan.id from E231 billing provider */
  planId: string
  name: string
  description: string
  /** Monthly price in dollars (display only) */
  monthlyPrice: number
  currency: string
  interval: Plan["interval"]
  features: string[]
  highlighted?: boolean
  badge?: string
  ctaLabel: string
  ctaHref: string
}

// Default tiers — replace with DB-driven data once the billing adapter is live
export const DEFAULT_PRICING_TIERS: PricingTier[] = [
  {
    planId: "free",
    name: "Free",
    description: "Get started with the basics.",
    monthlyPrice: 0,
    currency: "usd",
    interval: "month",
    features: ["1 project", "2 team members", "5 GB storage", "Community support"],
    ctaLabel: "Start for free",
    ctaHref: "/register",
  },
  {
    planId: "pro",
    name: "Pro",
    description: "For teams that need more power.",
    monthlyPrice: 29,
    currency: "usd",
    interval: "month",
    highlighted: true,
    badge: "Most popular",
    features: [
      "Unlimited projects",
      "10 team members",
      "50 GB storage",
      "Priority support",
      "Advanced analytics",
    ],
    ctaLabel: "Start Pro trial",
    ctaHref: "/register?plan=pro",
  },
  {
    planId: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large organisations.",
    monthlyPrice: 99,
    currency: "usd",
    interval: "month",
    features: [
      "Unlimited projects",
      "Unlimited team members",
      "500 GB storage",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
    ],
    ctaLabel: "Contact sales",
    ctaHref: "/register?plan=enterprise",
  },
]

interface PricingCardProps {
  tier: PricingTier
}

function PricingCard({ tier }: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
        tier.highlighted && "border-primary ring-2 ring-primary",
      )}
      data-plan-id={tier.planId}
    >
      {tier.badge && (
        <Badge className="absolute right-4 top-4" variant="default">
          {tier.badge}
        </Badge>
      )}
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-semibold">{tier.name}</h3>
        <p className="text-sm text-muted-foreground">{tier.description}</p>
      </div>
      <div className="flex items-baseline gap-1">
        {tier.monthlyPrice === 0 ? (
          <span className="text-4xl font-bold">Free</span>
        ) : (
          <>
            <span className="text-4xl font-bold">${tier.monthlyPrice}</span>
            <span className="text-muted-foreground">/{tier.interval}</span>
          </>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <span className="text-primary" aria-hidden="true">
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>
      <Button
        asChild
        variant={tier.highlighted ? "default" : "outline"}
        className="mt-auto"
        data-testid={`pricing-cta-${tier.planId}`}
      >
        <Link href={tier.ctaHref}>{tier.ctaLabel}</Link>
      </Button>
    </div>
  )
}

interface PricingProps {
  tiers?: PricingTier[]
}

export function Pricing({ tiers = DEFAULT_PRICING_TIERS }: PricingProps) {
  return (
    <section className="px-4 py-16 md:py-24" id="pricing">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            Choose the plan that fits your team. Upgrade or downgrade at any
            time — no lock-in.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <PricingCard key={tier.planId} tier={tier} />
          ))}
        </div>
      </div>
    </section>
  )
}
