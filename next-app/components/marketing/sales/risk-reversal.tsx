import { ShieldCheck, Users } from "lucide-react"

import type { SalesStyleTokens } from "@/lib/sales/styles"
import { cn } from "@/lib/utils"

export interface RiskReversalProps {
  heading: string
  guaranteeDays: number
  description: string
  studentsCount?: number
  style: SalesStyleTokens
  className?: string
}

/** 風險逆轉 (risk-reversal) — refund-guarantee badge + trust stat. Pure component. */
export function RiskReversal({
  heading,
  guaranteeDays,
  description,
  studentsCount,
  style,
  className,
}: RiskReversalProps) {
  return (
    <section className={cn("px-4 py-16 md:py-24", style.sectionBg, className)}>
      <div
        className={cn(
          "mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl p-8 text-center",
          style.card,
        )}
      >
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            style.badge,
          )}
        >
          <ShieldCheck className="size-7" aria-hidden="true" />
        </span>
        <p className={cn("text-sm font-semibold uppercase tracking-wide", style.accentText)}>
          {guaranteeDays} 天保證
        </p>
        <h2 className={cn("text-2xl md:text-3xl", style.heading)}>{heading}</h2>
        <p className={cn("leading-relaxed", style.subheading)}>{description}</p>
        {typeof studentsCount === "number" && (
          <p className={cn("mt-2 inline-flex items-center gap-1.5 text-sm", style.subheading)}>
            <Users className="size-4" aria-hidden="true" />
            已有 {studentsCount.toLocaleString("zh-TW")} 位學員信賴
          </p>
        )}
      </div>
    </section>
  )
}
