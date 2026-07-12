import type { SalesStyleTokens } from "@/lib/sales/styles"
import { cn } from "@/lib/utils"

export interface FaqItem {
  question: string
  answer: string
}

export interface SalesFaqProps {
  heading: string
  items: FaqItem[]
  style: SalesStyleTokens
  className?: string
}

/** FAQ section. Pure component — copy via props only. */
export function SalesFaq({ heading, items, style, className }: SalesFaqProps) {
  return (
    <section className={cn("px-4 py-16 md:py-24", style.sectionBg, className)}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <h2 className={cn("text-3xl md:text-4xl", style.heading)}>{heading}</h2>
        </div>
        <div>
          {items.map((item) => (
            <div key={item.question} className="flex flex-col gap-2 border-b py-4 last:border-b-0">
              <h3 className="font-medium">{item.question}</h3>
              <p className={cn("text-sm", style.subheading)}>{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
