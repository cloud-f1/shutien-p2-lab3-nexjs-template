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
  type SalesPageContent,
  type SalesSectionKey,
} from "@/lib/sales/content"
import { getCustomSalesPageLoader } from "@/lib/sales/custom-pages"
import {
  getAllSalesPageSlugs,
  getSalesPageContent,
  getSalesPageProduct,
} from "@/lib/sales/resolver"
import { getSalesStyleTokens, type SalesStyleTokens } from "@/lib/sales/styles"
import { cn } from "@/lib/utils"

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string }>
}

/**
 * The route reads a `?preview` search param (draft-preview tokens), which makes
 * it render on demand — so publish/unpublish/edit take effect immediately with
 * NO redeploy (the whole point of moving off build-time-only config). Publish
 * actions still `revalidatePath('/p/<slug>')` to drop any cached data fetch.
 * `generateStaticParams` (DB published ∪ config) seeds known slugs; unknown
 * slugs still render because `dynamicParams` is true.
 */
export const dynamicParams = true

export async function generateStaticParams() {
  const slugs = await getAllSalesPageSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const { preview } = await searchParams

  // Custom registry wins (E333): a registered slug owns its own metadata.
  const customLoader = getCustomSalesPageLoader(slug)
  if (customLoader) {
    const mod = await customLoader()
    return mod.metadata ?? {}
  }

  const content = await getSalesPageContent(slug, { previewToken: preview })
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

export default async function SalesPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { preview } = await searchParams

  // Render order (E333): custom registry FIRST → structured renderer (DB/config).
  // A registered slug renders its hand-authored page; the route resolves the
  // linked E327 product and injects it (checkout binding), so custom pages never
  // query prices or wire payment themselves.
  const customLoader = getCustomSalesPageLoader(slug)
  if (customLoader) {
    const { default: CustomSalesPage } = await customLoader()
    const product = await getSalesPageProduct(slug)
    return <CustomSalesPage slug={slug} product={product} />
  }

  // Route reads content ONLY through this resolver — DB-first, config fallback.
  // A draft page renders only with a valid `?preview=<token>`; otherwise 404.
  const content = await getSalesPageContent(slug, { previewToken: preview })
  if (!content) notFound()

  const style = getSalesStyleTokens(content.style.preset)
  const order = content.style.sectionOrder ?? DEFAULT_SECTION_ORDER

  return (
    <main className={cn("min-h-screen", style.page)}>
      {order.map((key) => SECTION_RENDERERS[key](content, style))}
    </main>
  )
}
