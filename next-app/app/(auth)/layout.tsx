import Link from "next/link"
import { Sparkles } from "lucide-react"

import { APP_NAME } from "@/lib/branding"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Form column */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
              <Sparkles className="size-4" />
            </span>
            {APP_NAME}
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
            ← 回首頁
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Brand / testimonial panel — desktop only */}
      <div className="bg-muted/40 relative hidden overflow-hidden border-l lg:flex lg:flex-col lg:justify-end">
        <div className="aurora" aria-hidden="true">
          <div className="aurora-blob b1" />
          <div className="aurora-blob b2" />
          <div className="aurora-blob b3" />
        </div>
        <div className="relative z-10 max-w-lg p-12">
          <blockquote className="text-2xl leading-snug font-medium tracking-tight">
            「這套起手式幫我們省下好幾週的基礎建設時間 —— 認證、金流、權限全都到位，第一天就能專注做產品。」
          </blockquote>
          <figcaption className="text-muted-foreground mt-6 text-sm">
            — 一支採用本模板的工程團隊
          </figcaption>
        </div>
      </div>
    </div>
  )
}
