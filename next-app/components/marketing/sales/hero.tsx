import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"

import { VideoDemo } from "@/components/marketing/video-demo"
import { Button } from "@/components/ui/button"
import type { SalesCtaBinding, SalesHeroVariant } from "@/lib/sales/types"
import type { SalesStyleTokens } from "@/lib/sales/styles"
import { cn } from "@/lib/utils"

export interface SalesHeroVideo {
  src?: string
  poster?: string
  captionsSrc?: string
}

export interface SalesHeroProps {
  badge?: string
  headline: string
  subheadline: string
  trustItems?: string[]
  cta: SalesCtaBinding
  video?: SalesHeroVideo
  /** Layout: video beside copy, video below copy, or copy-only (no video). */
  variant: SalesHeroVariant
  style: SalesStyleTokens
  className?: string
}

function HeroCopy({
  badge,
  headline,
  subheadline,
  trustItems,
  cta,
  style,
  centered,
}: Pick<SalesHeroProps, "badge" | "headline" | "subheadline" | "trustItems" | "cta" | "style"> & {
  centered: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-6", centered ? "items-center text-center" : "items-start text-left")}>
      {badge && (
        <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", style.badge)}>
          {badge}
        </span>
      )}
      <h1 className={cn("text-4xl md:text-6xl", style.heading)}>{headline}</h1>
      <p className={cn("max-w-2xl text-lg md:text-xl", style.subheading)}>{subheadline}</p>
      <Button asChild size="lg" className={style.ctaButton}>
        <Link href={cta.href}>
          {cta.label} <ArrowRight className="size-4" />
        </Link>
      </Button>
      {trustItems && trustItems.length > 0 && (
        <ul
          className={cn(
            "mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm",
            style.subheading,
            centered && "justify-center",
          )}
        >
          {trustItems.map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="text-success size-4" aria-hidden="true" /> {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Hero section — Hook video (E326) up top. Server Component; the only
 * client-hydrated piece is the embedded `<VideoDemo mode="inline">` video
 * element itself (plain HTML `<video>`, not a React client boundary).
 */
export function SalesHero({
  badge,
  headline,
  subheadline,
  trustItems,
  cta,
  video,
  variant,
  style,
  className,
}: SalesHeroProps) {
  if (variant === "minimal") {
    return (
      <section className={cn("relative overflow-hidden px-4 pt-20 pb-16 md:pt-28 md:pb-24", style.sectionBg, className)}>
        <div className="mx-auto max-w-3xl">
          <HeroCopy
            badge={badge}
            headline={headline}
            subheadline={subheadline}
            trustItems={trustItems}
            cta={cta}
            style={style}
            centered
          />
        </div>
      </section>
    )
  }

  if (variant === "video-left") {
    return (
      <section className={cn("relative overflow-hidden px-4 py-16 md:py-24", style.sectionBg, className)}>
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2 md:items-center">
          <VideoDemo mode="inline" src={video?.src} poster={video?.poster} captionsSrc={video?.captionsSrc} />
          <HeroCopy
            badge={badge}
            headline={headline}
            subheadline={subheadline}
            trustItems={trustItems}
            cta={cta}
            style={style}
            centered={false}
          />
        </div>
      </section>
    )
  }

  // variant === "video-top" (default)
  return (
    <section className={cn("relative overflow-hidden px-4 pt-20 pb-16 md:pt-28 md:pb-24", style.sectionBg, className)}>
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <HeroCopy
          badge={badge}
          headline={headline}
          subheadline={subheadline}
          trustItems={trustItems}
          cta={cta}
          style={style}
          centered
        />
      </div>
      <div className="relative z-10 mx-auto mt-14 max-w-3xl">
        <VideoDemo mode="inline" src={video?.src} poster={video?.poster} captionsSrc={video?.captionsSrc} />
      </div>
    </section>
  )
}
