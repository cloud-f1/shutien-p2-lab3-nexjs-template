import Link from "next/link"
import { ArrowRight, Check, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { VideoDemo } from "@/components/marketing/video-demo"

const TRUST = ["無需信用卡 · No credit card", "幾分鐘即可部署 · Deploy in minutes", "MIT 授權 · MIT licensed"]

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-16 md:pt-28 md:pb-24" id="top">
      {/* Aurora backdrop (E260) */}
      <div className="aurora" aria-hidden="true">
        <div className="aurora-blob b1" />
        <div className="aurora-blob b2" />
        <div className="aurora-blob b3" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        {/* "New" pill */}
        <div className="hero-in hero-d1 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-sm shadow-xs backdrop-blur">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            <Sparkles className="size-3" /> New
          </span>
          <span className="text-muted-foreground">AI-Ready 模組化金流現已登場</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
        </div>

        <h1 className="hero-in hero-d2 text-4xl font-bold tracking-tight md:text-6xl">
          打造你的 SaaS，{" "}
          <span className="shimmer-text">比以往更快</span>
        </h1>

        <p className="hero-in hero-d3 max-w-2xl text-lg text-muted-foreground md:text-xl">
          內建認證、3 階 RBAC、模組化金流（Stripe + 綠界）與深色主題的
          Next.js 起手式 —— 讓你專注在產品本身，而非重造輪子。
        </p>

        <div className="hero-in hero-d4 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="glow-cta shine">
            <Link href="/register">
              免費開始 <ArrowRight className="size-4" />
            </Link>
          </Button>
          <VideoDemo />
        </div>

        <ul className="hero-in hero-d5 mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check className="size-4 text-success" /> {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Product-preview mockup */}
      <div className="hero-in hero-d5 relative z-10 mx-auto mt-14 max-w-4xl">
        <div className="lift overflow-hidden rounded-2xl border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <span className="size-3 rounded-full bg-destructive/60" />
            <span className="size-3 rounded-full bg-warning/70" />
            <span className="size-3 rounded-full bg-success/70" />
            <span className="ml-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="live-dot relative inline-block size-2 rounded-full bg-success" />
              app.example.com/dashboard
            </span>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            {[
              { label: "月營收 MRR", value: "$48,250", delta: "+12.4%" },
              { label: "活躍用戶", value: "8,942", delta: "+3.1%" },
              { label: "訂閱轉換", value: "24.8%", delta: "+1.9%" },
            ].map((k) => (
              <div key={k.label} className="kpi rounded-xl border p-4 text-left">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="tnum mt-1 text-2xl font-semibold">{k.value}</p>
                <p className="text-xs text-success">{k.delta}</p>
              </div>
            ))}
            <div className="rounded-xl border p-4 sm:col-span-3">
              <div className="flex items-end gap-1.5">
                {[38, 52, 44, 66, 58, 79, 72, 91, 84, 100, 92, 110].map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-t bg-primary/70"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
