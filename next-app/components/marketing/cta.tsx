import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"

import { Button } from "@/components/ui/button"

export function Cta() {
  return (
    <section className="px-4 py-16 md:py-24" id="cta">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border bg-card px-8 py-14 text-center shadow-sm">
        {/* Aurora wash (E260) */}
        <div className="aurora" aria-hidden="true">
          <div className="aurora-blob b1" />
          <div className="aurora-blob b2" />
        </div>
        <div className="relative z-10">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            準備好打造你的 SaaS 了嗎？
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
            加入正在用這套模板更快出貨的開發者。幾分鐘就能上手，而不是好幾天。
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="glow-cta shine">
              <Link href="/register">
                免費開始 <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="https://github.com" target="_blank" rel="noopener noreferrer">
                <Star className="size-4" /> 在 GitHub 查看
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
