import {
  Blocks,
  CreditCard,
  Database,
  Lock,
  Palette,
  Rocket,
  type LucideIcon,
} from "lucide-react"

import { Reveal } from "@/components/marketing/reveal"

interface Feature {
  title: string
  description: string
  Icon: LucideIcon
}

const FEATURES: Feature[] = [
  {
    Icon: Lock,
    title: "內建認證",
    description:
      "NextAuth v5：Email/密碼、Email 驗證、與 3 階 RBAC（admin/editor/viewer），開箱即用。",
  },
  {
    Icon: CreditCard,
    title: "模組化金流",
    description:
      "PaymentProvider 抽象層支援 Stripe 與綠界 ECPay 定期定額。換金流不必動到業務邏輯。",
  },
  {
    Icon: Database,
    title: "Drizzle 資料庫",
    description:
      "型別安全的 Drizzle ORM + PostgreSQL。遷移、seed、schema fragment 全部齊備。",
  },
  {
    Icon: Palette,
    title: "深色主題",
    description:
      "Tailwind v4 + next-themes + shadcn/ui。class 策略深色模式，一個按鍵即可切換。",
  },
  {
    Icon: Blocks,
    title: "Registry 模組",
    description:
      "用 `npx shadcn@latest add @saas/<module>` 安裝整個功能模組，附 manifest 與安裝 skill。",
  },
  {
    Icon: Rocket,
    title: "隨處部署",
    description:
      "內含 Zeabur 設定與 Dockerfile，單一 Next.js 服務、啟動自動遷移。Cloud Run 亦可。",
  },
]

function FeatureCard({ Icon, title, description }: Feature) {
  return (
    <div className="lift flex flex-col gap-3 rounded-xl border bg-card p-6 text-card-foreground shadow-xs">
      <span className="icon-tile icon-tile-brand">
        <Icon className="size-[18px]" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function Features() {
  return (
    <section className="px-4 py-16 md:py-24" id="features">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            出貨所需，一應俱全
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            別再重造同樣的樣板。這套模板把基礎設施都處理好了，讓你第一天就能開始做核心產品。
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delayMs={i * 60}>
              <FeatureCard {...feature} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
