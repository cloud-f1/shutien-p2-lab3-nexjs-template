import Link from "next/link"

const FOOTER_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Register" },
]

export function MarketingFooter() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} SaaS Template. All rights
            reserved.
          </p>
          <nav className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            {FOOTER_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
