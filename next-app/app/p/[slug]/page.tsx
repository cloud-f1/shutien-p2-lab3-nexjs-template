import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PainPoints } from "@/components/marketing/sales/pain-points"
import { ModulesTable } from "@/components/marketing/sales/modules-table"
import { SalesFaq } from "@/components/marketing/sales/faq"
import { SalesHero } from "@/components/marketing/sales/hero"
import { SalesPricing } from "@/components/marketing/sales/pricing"
import { RiskReversal } from "@/components/marketing/sales/risk-reversal"
import { Solution } from "@/components/marketing/sales/solution"
import { SalesTestimonials } from "@/components/marketing/sales/testimonials"
import {
  DEFAULT_SECTION_ORDER,
  getAllSalesPageSlugs,
  getSalesPageContent,
  type SalesPageContent,
  type SalesSectionKey,
} from "@/lib/sales/content"
import { getSalesStyleTokens, type SalesStyleTokens } from "@/lib/sales/styles"
import { cn } from "@/lib/utils"

interface PageProps {
  params: Promise<{ slug: string }>
}

/** Static params for every configured sales page — SSG at build time. */
export function generateStaticParams() {
  return getAllSalesPageSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const content = getSalesPageContent(slug)
  if (!content) return {}

  const images = content.meta.ogImage ? [content.meta.ogImage] : undefined
  return {
    title: content.meta.title,
    description: content.meta.description,
    openGraph: {
      title: content.meta.title,
      description: content.meta.description,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: content.meta.title,
      description: content.meta.description,
      images,
    },
  }
}

/** One renderer per section key — every section component is pure (props in only). */
const SECTION_RENDERERS: Record<
  SalesSectionKey,
  (content: SalesPageContent, style: SalesStyleTokens) => React.ReactNode
> = {
  hero: (content, style) => (
    <SalesHero
      key="hero"
      {...content.hero}
      variant={content.style.heroVariant ?? "video-top"}
      style={style}
    />
  ),
  painPoints: (content, style) => (
    <PainPoints key="painPoints" {...content.painPoints} style={style} />
  ),
  solution: (content, style) => <Solution key="solution" {...content.solution} style={style} />,
  modules: (content, style) => <ModulesTable key="modules" {...content.modules} style={style} />,
  testimonials: (content, style) => (
    <SalesTestimonials key="testimonials" {...content.testimonials} style={style} />
  ),
  pricing: (content, style) => <SalesPricing key="pricing" {...content.pricing} style={style} />,
  riskReversal: (content, style) => (
    <RiskReversal key="riskReversal" {...content.riskReversal} style={style} />
  ),
  faq: (content, style) => <SalesFaq key="faq" {...content.faq} style={style} />,
}

export default async function SalesPage({ params }: PageProps) {
  const { slug } = await params
  // Route reads content ONLY through this resolver — never the raw config map.
  const content = getSalesPageContent(slug)
  if (!content) notFound()

  const style = getSalesStyleTokens(content.style.preset)
  const order = content.style.sectionOrder ?? DEFAULT_SECTION_ORDER

  return (
    <main className={cn("min-h-screen", style.page)}>
      {order.map((key) => SECTION_RENDERERS[key](content, style))}
    </main>
  )
}
