import Link from "next/link"
import { Check } from "lucide-react"

import { CountdownTimer } from "@/components/marketing/sales/countdown-timer"
import { Button } from "@/components/ui/button"
import type { SalesCtaBinding } from "@/lib/sales/types"
import type { SalesStyleTokens } from "@/lib/sales/styles"
import { cn } from "@/lib/utils"

export interface SalesPricingProps {
  heading: string
  price: number
  originalPrice?: number
  currency: string
  /** ISO datetime string — feeds the countdown timer. */
  deadline: string
  features?: string[]
  /** Placeholder link/binding point — real checkout wiring lands in E327. */
  cta: SalesCtaBinding
  style: SalesStyleTokens
  className?: string
}

function formatPrice(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("zh-TW")}`
}

/**
 * 定價 + 倒數 (pricing + urgency) section. Server Component — only the
 * embedded `<CountdownTimer>` hydrates. The CTA below is a plain `<Link>`
 * (binding point only); actual checkout wiring lands in E327.
 */
export function SalesPricing({
  heading,
  price,
  originalPrice,
  currency,
  deadline,
  features,
  cta,
  style,
  className,
}: SalesPricingProps) {
  return (
    <section className={cn("px-4 py-16 md:py-24", style.sectionBgAlt, className)}>
      <div
        className={cn(
          "mx-auto flex max-w-xl flex-col items-center gap-6 rounded-2xl p-8 text-center",
          style.card,
        )}
      >
        <h2 className={cn("text-3xl md:text-4xl", style.heading)}>{heading}</h2>

        <div className="flex items-baseline gap-2">
          {originalPrice && originalPrice > price && (
            <span className="text-muted-foreground text-lg line-through">
              {formatPrice(originalPrice, currency)}
            </span>
          )}
          <span className={cn("text-4xl font-bold", style.heading)}>
            {formatPrice(price, currency)}
          </span>
        </div>

        {features && features.length > 0 && (
          <ul className="flex flex-col gap-2 text-left">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className={cn("mt-0.5 size-4 shrink-0", style.accentText)} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <CountdownTimer deadline={deadline} />

        <Button asChild size="lg" className={cn("w-full sm:w-auto", style.ctaButton)}>
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      </div>
    </section>
  )
}
