import type { Metadata } from "next"

import { Cta } from "@/components/marketing/cta"
import { Faq } from "@/components/marketing/faq"
import { Features } from "@/components/marketing/features"
import { Hero } from "@/components/marketing/hero"
import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { MarketingNav } from "@/components/marketing/marketing-nav"
import { Pricing } from "@/components/marketing/pricing"
import { SocialProof } from "@/components/marketing/social-proof"
import { Testimonials } from "@/components/marketing/testimonials"
import { UseCases } from "@/components/marketing/use-cases"

export const metadata: Metadata = {
  title: "Next.js SaaS 起手式 · AI-Ready Modular Template",
  description:
    "內建認證、3 階 RBAC、模組化金流（Stripe + 綠界）與深色主題的 Next.js SaaS 起手式。",
}

export default function Page() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <SocialProof />
        <Features />
        <UseCases />
        <Testimonials />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <MarketingFooter />
    </>
  )
}
