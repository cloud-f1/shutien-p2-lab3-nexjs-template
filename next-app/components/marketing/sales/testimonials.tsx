import { Reveal } from "@/components/marketing/reveal"
import type { SalesStyleTokens } from "@/lib/sales/styles"
import { cn } from "@/lib/utils"

export interface TestimonialItem {
  quote: string
  name: string
  role: string
}

export interface SalesTestimonialsProps {
  heading: string
  items: TestimonialItem[]
  style: SalesStyleTokens
  className?: string
}

/** 見證 (testimonials/social-proof) section. Pure component — copy via props. */
export function SalesTestimonials({ heading, items, style, className }: SalesTestimonialsProps) {
  return (
    <section className={cn("px-4 py-16 md:py-24", style.sectionBg, className)}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <h2 className={cn("text-3xl md:text-4xl", style.heading)}>{heading}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((t, i) => (
            <Reveal key={t.name} delayMs={i * 80}>
              <figure className={cn("lift flex h-full flex-col gap-4 rounded-xl p-6", style.card)}>
                <blockquote className="text-sm leading-relaxed">「{t.quote}」</blockquote>
                <figcaption className="mt-auto">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className={cn("text-xs", style.subheading)}>{t.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
