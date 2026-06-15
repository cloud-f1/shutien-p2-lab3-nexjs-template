"use client"

import { useState, useTransition } from "react"
import Link from "next/link"

import { createCheckoutSession } from "@/actions/billing"
import { PRICING_TIERS, type PricingTier } from "@/lib/billing/pricing"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type BillingPeriod = "monthly" | "yearly"

interface PricingCardProps {
  tier: PricingTier
}

function PricingCard({ tier, period }: PricingCardProps & { period: BillingPeriod }) {
  // Yearly = 10× monthly (2 months free) — display-only; data shape unchanged.
  const yearly = tier.monthlyPrice * 10
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubscribe() {
    if (!tier.providerPriceId) return
    setError(null)
    startTransition(async () => {
      const origin = window.location.origin
      const res = await createCheckoutSession(
        tier.providerPriceId!,
        `${origin}/dashboard/system?billing=success`,
        `${origin}/#pricing`,
      )
      if (res.success && res.checkoutUrl) window.location.href = res.checkoutUrl
      else setError(res.error ?? "無法開始結帳，請稍後再試。")
    })
  }

  return (
    <div
      className={cn(
        "lift relative flex flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-xs",
        tier.highlighted && "border-primary shadow-md ring-2 ring-primary md:-translate-y-2",
      )}
      data-plan-id={tier.slug}
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
          <span className="text-4xl font-bold">免費</span>
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
      <div className="mt-auto flex flex-col gap-1.5">
        {tier.providerPriceId ? (
          <Button
            variant={tier.highlighted ? "default" : "outline"}
            onClick={onSubscribe}
            disabled={pending}
            data-testid={`pricing-cta-${tier.slug}`}
          >
            {pending ? "處理中…" : tier.ctaLabel}
          </Button>
        ) : (
          <Button
            asChild
            variant={tier.highlighted ? "default" : "outline"}
            data-testid={`pricing-cta-${tier.slug}`}
          >
            <Link href="/register">{tier.ctaLabel}</Link>
          </Button>
        )}
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

interface PricingProps {
  tiers?: PricingTier[]
}

export function Pricing({ tiers = PRICING_TIERS }: PricingProps) {
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
            <PricingCard key={tier.slug} tier={tier} period={period} />
          ))}
        </div>
        <p className="text-muted-foreground mt-6 text-center text-xs">
          所有方案皆含核心功能 · 企業方案另提供 SSO、稽核紀錄與 SLA。
        </p>
      </div>
    </section>
  )
}
