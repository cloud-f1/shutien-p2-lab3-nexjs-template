import { Cta } from "@/components/marketing/cta"
import { Faq } from "@/components/marketing/faq"
import { Features } from "@/components/marketing/features"
import { Hero } from "@/components/marketing/hero"
import { Pricing } from "@/components/marketing/pricing"

export const metadata = {
  title: "SaaS Template — Build your product faster",
  description:
    "A production-ready Next.js SaaS starter with auth, billing, and admin built-in.",
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <Pricing />
      <Faq />
      <Cta />
    </>
  )
}
