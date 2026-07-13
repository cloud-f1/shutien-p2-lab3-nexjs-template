import type { Metadata } from "next"
import Image from "next/image"
import { ArrowRight, Check, Rocket, ShieldCheck, Sparkles, Star, Zap } from "lucide-react"

import { CountdownTimer } from "@/components/marketing/sales/countdown-timer"
import { SalesCheckoutButton } from "@/components/marketing/sales/checkout-button"
import { VideoDemo } from "@/components/marketing/video-demo"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { SalesPageProps } from "@/lib/sales/custom-pages"
import { cn } from "@/lib/utils"

/**
 * Reference custom sales page — E333.
 *
 * This is the "tier 3 / custom" proof-of-path: a fully hand-authored, off-grid
 * TSX layout that the structured section pipeline (E326) can't express, yet
 * still plugs into every sales mechanic for free via `SalesPageProps`:
 *   - CTA → `<SalesCheckoutButton productSlug={product.slug}>` → E327 checkout
 *   - urgency → `<CountdownTimer>` (E326)
 *   - hook video → `<VideoDemo mode="inline">` (E326)
 *   - thank-you → the shared `/p/[slug]/thanks` route (E327) — nothing to build
 *
 * Hard rules it demonstrates (see the sales-page-builder skill):
 *   - NO inline `style=` colour overrides — every colour is a design token
 *     Tailwind utility (`bg-primary`, `text-muted-foreground`, …) so dark mode
 *     just works and the Stop-verifier stays green.
 *   - `cn()` for conditional classes; `next/image` for raster art.
 *   - Server Component by default — only the countdown + checkout button (and
 *     the inline <video>) hydrate.
 */

/** Deadline for the launch cohort — drives the countdown urgency block. */
const LAUNCH_DEADLINE = "2030-01-01T15:59:59.000Z"

const OUTCOMES = [
  { icon: Rocket, title: "上線第一個 AI 功能", body: "把課堂範例直接搬進你自己的產品，14 天內跑在正式環境。" },
  { icon: Zap, title: "可複製的 workflow", body: "一套從需求拆解到部署的 SOP，之後每個功能都照著做，不再從零摸索。" },
  { icon: Sparkles, title: "作品集級成果", body: "結業時你手上有一個能對外展示、能寫進履歷的完整 AI 產品。" },
]

const SYLLABUS = [
  { week: "Week 1", title: "定位與資料", body: "選對第一個要做的 AI 功能，設計資料與評估流程。" },
  { week: "Week 2", title: "實作與整合", body: "把模型接進 Next.js App Router，串好 Server Actions 與金流。" },
  { week: "Week 3", title: "上線與優化", body: "部署、監控、成本與延遲調校，交付一個真正能收錢的產品。" },
]

const TESTIMONIALS = [
  { quote: "三週把客服自動分類做上線，準確率超出團隊預期。", name: "陳先生", role: "新創技術長" },
  { quote: "不只是教用 AI，而是陪我把它做進產品、真的收到錢。", name: "林小姐", role: "獨立開發者" },
  { quote: "課程節奏很緊湊，但每一步都能立刻用在自己的專案上。", name: "黃同學", role: "轉職工程師" },
]

const FAQ = [
  { q: "沒有 AI 經驗可以上嗎？", a: "可以。課程假設你會寫基本的 JavaScript/TypeScript，AI 部分從零帶起。" },
  { q: "需要自備產品題目嗎？", a: "建議帶自己的題目效果最好；沒有的話我們提供可直接落地的範例題目。" },
  { q: "跟不上進度怎麼辦？", a: "全程錄影可回放，並有專屬社群與每週答疑，7 天內不滿意全額退費。" },
]

/** Format a smallest-currency-unit amount as a display price (TWD is 1:1). */
function formatPrice(amount: number, currency: string): string {
  const value = currency.toUpperCase() === "TWD" ? amount : amount / 100
  return `${currency.toUpperCase()} ${value.toLocaleString("zh-TW")}`
}

export const metadata: Metadata = {
  title: "AI 上線特訓營 —— 3 週把 AI 功能做進你的產品",
  description: "不是又一堂看完就忘的 AI 課。3 週實作陪跑，結業時你有一個能對外收錢的 AI 產品。",
  openGraph: {
    title: "AI 上線特訓營 —— 3 週把 AI 功能做進你的產品",
    description: "3 週實作陪跑，結業時你有一個能對外收錢的 AI 產品。",
    type: "website",
  },
}

export default function AiLaunchIntensivePage({ product }: SalesPageProps) {
  const price = product ? formatPrice(product.amount, product.currency) : null

  return (
    <main className="bg-background text-foreground min-h-screen" data-testid="custom-sales-page">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="from-primary/10 via-background to-background relative overflow-hidden bg-gradient-to-b px-4 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
          <Badge className="bg-primary/15 text-primary hover:bg-primary/15 gap-1.5 rounded-full px-3 py-1">
            <Sparkles className="size-3.5" aria-hidden="true" /> 本期限額 30 位
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-balance md:text-6xl">
            3 週，把 AI 功能<span className="text-primary">真正做進</span>你的產品
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-pretty md:text-xl">
            不是又一堂看完就忘的 AI 課。實作陪跑到底，結業時你手上有一個能對外展示、能收錢的 AI 產品。
          </p>
          <div className="flex flex-col items-center gap-3">
            <SalesCheckoutButton
              productSlug={product?.slug}
              label="立即報名特訓營"
              size="lg"
              className="shine glow-cta"
            />
            {price && (
              <p className="text-muted-foreground text-sm">
                單次付費 <span className="text-foreground font-semibold">{price}</span> · 7 天不滿意全額退費
              </p>
            )}
          </div>
          <ul className="text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            {["已陪跑 40+ 團隊", "平均 14 天上線", "滿意度 98%"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="text-success size-4" aria-hidden="true" /> {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 mx-auto mt-14 max-w-3xl">
          <VideoDemo
            mode="inline"
            src="/sales/ai-launch-intensive/hook.mp4"
            poster="/sales/ai-launch-intensive/hook-poster.jpg"
            captionsSrc="/sales/ai-launch-intensive/hook-captions.vtt"
          />
        </div>
      </section>

      {/* ── Outcomes ─────────────────────────────────────────────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">結業時你會帶走</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {OUTCOMES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-card flex flex-col gap-3 rounded-2xl border p-6 shadow-xs"
              >
                <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Syllabus + product mockup ────────────────────────────────────── */}
      <section className="bg-muted/30 px-4 py-16 md:py-24">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">三週實作路線圖</h2>
            <ol className="mt-8 space-y-6">
              {SYLLABUS.map(({ week, title, body }, i) => (
                <li key={week} className="flex gap-4">
                  <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {week}
                    </p>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-muted-foreground text-sm">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-card relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border shadow-lg">
            <Image
              src="/sales/ai-launch-intensive/dashboard.png"
              alt="學員專案上線後的產品畫面預覽"
              fill
              className="object-cover"
              sizes="(min-width: 768px) 40vw, 90vw"
            />
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">學員怎麼說</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map(({ quote, name, role }) => (
              <figure key={name} className="bg-card flex flex-col gap-4 rounded-2xl border p-6 shadow-xs">
                <div className="text-primary flex gap-0.5" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <blockquote className="text-sm leading-relaxed">「{quote}」</blockquote>
                <figcaption className="text-muted-foreground text-sm">
                  <span className="text-foreground font-medium">{name}</span> · {role}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Offer + urgency + risk reversal ──────────────────────────────── */}
      <section className="bg-primary/5 px-4 py-16 md:py-24">
        <div className="bg-card mx-auto flex max-w-xl flex-col items-center gap-6 rounded-3xl border-2 border-primary/30 p-8 text-center shadow-lg md:p-10">
          <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive rounded-full px-3 py-1">
            本期報名倒數
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">限時招生方案</h2>
          {price ? (
            <p className="text-5xl font-bold">{price}</p>
          ) : (
            <p className="text-muted-foreground text-lg">名額釋出中，敬請期待</p>
          )}
          <CountdownTimer
            deadline={LAUNCH_DEADLINE}
            accentClassName="bg-primary text-primary-foreground"
          />
          <ul className="flex flex-col gap-2 text-left">
            {["3 週實作陪跑 + 每週答疑", "全程錄影可回放", "專屬學員社群", "7 天不滿意全額退費"].map(
              (feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ),
            )}
          </ul>
          <SalesCheckoutButton
            productSlug={product?.slug}
            label="立即報名特訓營"
            size="lg"
            className="shine glow-cta w-full sm:w-auto"
          />
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> 由金流商安全結帳，免註冊即可購買
          </p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">常見問題</h2>
          <dl className="mt-10 space-y-4">
            {FAQ.map(({ q, a }, i) => (
              <div key={q}>
                <dt className="font-semibold">{q}</dt>
                <dd className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{a}</dd>
                {i < FAQ.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </dl>
          <div className="mt-12 flex flex-col items-center gap-4">
            <p className="text-muted-foreground text-center text-sm">還在猶豫？名額有限，先卡位再說。</p>
            <SalesCheckoutButton
              productSlug={product?.slug}
              label="立即報名特訓營"
              size="lg"
              className={cn("shine glow-cta")}
            />
            <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <ArrowRight className="size-3.5" aria-hidden="true" /> 報名後將以 Email 寄送上課資訊
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
