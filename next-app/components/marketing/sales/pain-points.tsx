import { X } from "lucide-react"

import type { SalesStyleTokens } from "@/lib/sales/styles"
import { cn } from "@/lib/utils"

export interface PainPointsProps {
  heading: string
  intro?: string
  items: string[]
  style: SalesStyleTokens
  className?: string
}

/**
 * 痛點共鳴 (pain-points resonance) section. Pure — takes copy + style tokens
 * as props only, no config/DB import.
 */
export function PainPoints({ heading, intro, items, style, className }: PainPointsProps) {
  return (
    <section className={cn("px-4 py-16 md:py-24", style.sectionBgAlt, className)}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <h2 className={cn("text-3xl md:text-4xl", style.heading)}>{heading}</h2>
          {intro && <p className={style.subheading}>{intro}</p>}
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item} className={cn("flex items-start gap-3 rounded-xl p-4", style.card)}>
              <X className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span className="text-sm leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
