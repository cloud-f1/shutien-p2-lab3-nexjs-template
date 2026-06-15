"use client"

import { useState } from "react"
import Link from "next/link"

import type { Plan } from "@/lib/billing/provider"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type BillingPeriod = "monthly" | "yearly"

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

function PricingCard({ tier, period }: PricingCardProps & { period: BillingPeriod }) {
  // Yearly = 10× monthly (2 months free) — display-only; data shape unchanged.
  const yearly = tier.monthlyPrice * 10
  return (
    <div
      className={cn(
        "lift relative flex flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-xs",
        tier.highlighted && "border-primary shadow-md ring-2 ring-primary md:-translate-y-2",
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
        ) : period === "yearly" ? (
          <>
            <span className="text-4xl font-bold">${yearly}</span>
            <span className="text-muted-foreground">/年</span>
          </>
        ) : (
          <>
            <span className="text-4xl font-bold">${tier.monthlyPrice}</span>
            <span className="text-muted-foreground">/月</span>
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
  const [period, setPeriod] = useState<BillingPeriod>("monthly")
  return (
    <section className="px-4 py-16 md:py-24" id="pricing">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">簡單透明的定價</h2>
          <p className="text-muted-foreground max-w-2xl">選擇適合你團隊的方案，隨時升降級，無綁約。</p>
          {/* Monthly / yearly toggle (segmented) */}
          <div className="bg-secondary inline-flex rounded-lg p-1" role="group" aria-label="計費週期">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  period === p ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
                )}
              >
                {p === "monthly" ? "每月" : "每年"}
                {p === "yearly" && <span className="text-success ml-1 text-xs">省 2 個月</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <PricingCard key={tier.planId} tier={tier} period={period} />
          ))}
        </div>
        <p className="text-muted-foreground mt-6 text-center text-xs">
          所有方案皆含核心功能 · 企業方案另提供 SSO、稽核紀錄與 SLA。
        </p>
      </div>
    </section>
  )
}
