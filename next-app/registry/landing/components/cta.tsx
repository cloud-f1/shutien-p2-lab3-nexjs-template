import Link from "next/link"

import { Button } from "@/components/ui/button"

export function Cta() {
  return (
    <section className="px-4 py-16 md:py-24" id="cta">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-muted/40 px-8 py-12 text-center">
        <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
          Ready to build your SaaS?
        </h2>
        <p className="mb-8 text-muted-foreground">
          Join developers who are shipping faster with this template. Set up in
          minutes, not days.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">Get started free</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="https://github.com" target="_blank" rel="noopener noreferrer">
              View on GitHub
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
