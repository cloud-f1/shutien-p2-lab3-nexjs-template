"use client"

import { Briefcase, Code2, Rocket, Users } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const CASES = [
  {
    value: "startups",
    icon: Rocket,
    label: "新創團隊",
    title: "幾天內上線，而非幾個月",
    body: "認證、金流、權限與部署設定全部到位，第一天就能驗證你的點子。",
    points: ["免費方案即可開始", "Stripe + 綠界金流", "一鍵 Zeabur / Cloud Run 部署"],
  },
  {
    value: "engineering",
    icon: Code2,
    label: "工程團隊",
    title: "型別安全、模組化、可維護",
    body: "Next.js 16 + Drizzle + shadcn/ui，模組以 @saas registry 安裝/拆卸，乾淨可逆。",
    points: ["Server Components 優先", "Drizzle 型別安全 DB", "registry 模組化功能"],
  },
  {
    value: "business",
    icon: Briefcase,
    label: "企業營運",
    title: "3 階 RBAC 與稽核就緒",
    body: "admin / editor / viewer 角色、後台管理、稽核紀錄（Phase 62），符合 B2B 需求。",
    points: ["3 階角色權限", "後台管理面板", "稽核 + API keys（規劃中）"],
  },
  {
    value: "teams",
    icon: Users,
    label: "跨團隊協作",
    title: "邀請成員、分配角色",
    body: "團隊邀請、權限矩陣與成員狀態管理（Phase 62），讓協作清晰可控。",
    points: ["成員邀請流程", "權限矩陣", "成員狀態追蹤"],
  },
]

export function UseCases() {
  return (
    <section className="px-4 py-16 md:py-24" id="solutions">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">為各種團隊打造</h2>
          <p className="text-muted-foreground max-w-2xl">無論你是新創、工程團隊還是企業營運，都能快速上手。</p>
        </div>
        <Tabs defaultValue="startups" className="gap-6">
          <TabsList className="mx-auto flex-wrap">
            {CASES.map((c) => (
              <TabsTrigger key={c.value} value={c.value} className="gap-1.5">
                <c.icon className="size-4" /> {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {CASES.map((c) => (
            <TabsContent key={c.value} value={c.value}>
              <div className="bg-card grid gap-6 rounded-2xl border p-8 md:grid-cols-2">
                <div className="space-y-3">
                  <span className="icon-tile icon-tile-brand">
                    <c.icon className="size-[18px]" />
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">{c.title}</h3>
                  <p className="text-muted-foreground">{c.body}</p>
                </div>
                <ul className="flex flex-col justify-center gap-3">
                  {c.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <span className="dot dot-success" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
