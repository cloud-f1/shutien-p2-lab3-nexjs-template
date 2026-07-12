import Image from "next/image"
import { Check } from "lucide-react"

import type { SalesStyleTokens } from "@/lib/sales/styles"
import { cn } from "@/lib/utils"

export interface SolutionProps {
  heading: string
  description: string
  bullets?: string[]
  /** Product-mockup slot — an image URL, or a styled placeholder if omitted. */
  mockupImage?: string
  style: SalesStyleTokens
  className?: string
}

/** 解決方案 (solution) section + product-mockup slot. Pure component. */
export function Solution({
  heading,
  description,
  bullets,
  mockupImage,
  style,
  className,
}: SolutionProps) {
  return (
    <section className={cn("px-4 py-16 md:py-24", style.sectionBg, className)}>
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2 md:items-center">
        <div className="flex flex-col gap-4">
          <h2 className={cn("text-3xl md:text-4xl", style.heading)}>{heading}</h2>
          <p className={cn("leading-relaxed", style.subheading)}>{description}</p>
          {bullets && bullets.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm">
                  <Check className={cn("mt-0.5 size-4 shrink-0", style.accentText)} aria-hidden="true" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Product mockup slot */}
        <div
          className={cn(
            "relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl",
            style.card,
          )}
        >
          {mockupImage ? (
            <Image
              src={mockupImage}
              alt="產品畫面預覽"
              fill
              className="object-cover"
              sizes="(min-width: 768px) 40vw, 90vw"
            />
          ) : (
            <div className="aurora" aria-hidden="true">
              <div className="aurora-blob b1" />
              <div className="aurora-blob b2" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
