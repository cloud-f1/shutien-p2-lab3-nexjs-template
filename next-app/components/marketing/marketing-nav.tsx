import Link from "next/link"

import { Button } from "@/components/ui/button"

const NAV_LINKS = [
  { href: "#features", label: "功能" },
  { href: "#solutions", label: "解決方案" },
  { href: "#pricing", label: "定價" },
  { href: "#faq", label: "FAQ" },
]

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight hover:opacity-80"
        >
          SaaS Template
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
