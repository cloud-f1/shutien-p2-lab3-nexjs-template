import Link from "next/link"

import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="flex flex-col items-center justify-center gap-6 px-4 py-24 text-center md:py-32">
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Build your SaaS{" "}
          <span className="text-primary">faster than ever</span>
        </h1>
        <p className="text-lg text-muted-foreground md:text-xl">
          A production-ready Next.js SaaS starter with auth, billing, and
          admin — so you can focus on what makes your product unique.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/register">Get started free</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        No credit card required &middot; Deploy in minutes
      </p>
    </section>
  )
}
