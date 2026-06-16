import Link from "next/link"

import { APP_NAME } from "@/lib/branding"

const FOOTER_LINKS = [
  { href: "#features", label: "功能" },
  { href: "#pricing", label: "定價" },
  { href: "#faq", label: "常見問題" },
  { href: "/login", label: "登入" },
  { href: "/register", label: "註冊" },
]

export function MarketingFooter() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {APP_NAME}. 版權所有。
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
