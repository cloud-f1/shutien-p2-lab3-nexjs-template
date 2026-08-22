import type { Metadata } from "next"

import { requireAuth } from "@/lib/permissions"
import type { AuditEntry } from "@/lib/audit"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { StatusLight } from "@/components/status-light"
import { ProgressBar } from "@/components/progress-bar"
import { TypeChip } from "@/components/type-chip"
import { RoleBadge } from "@/components/role-badge"
import { SectionCards } from "@/components/section-cards"
import { GreetingHeader } from "@/components/dashboard/greeting-header"
import { StatCard } from "@/components/dashboard/stat-card"
import { StatCardRow } from "@/components/dashboard/stat-card-row"
import { TrendChart } from "@/components/dashboard/trend-chart"
import { StackChart } from "@/components/dashboard/stack-chart"
import { RankChart } from "@/components/dashboard/rank-chart"
import { AttentionCard } from "@/components/dashboard/attention-card"
import { UpcomingCard } from "@/components/dashboard/upcoming-card"
import { ActivityCard } from "@/components/dashboard/activity-card"
import { FilterChipShowcase } from "./_filter-chip-showcase"

// Demo data for the dashboard widget kit (E337) showcase below — this page
// is a static reference gallery, not a real data source, so every number
// here is illustrative only.
const DEMO_TREND = [
  { label: "3月", value: 8 },
  { label: "4月", value: 14 },
  { label: "5月", value: 11 },
  { label: "6月", value: 19 },
  { label: "7月", value: 15 },
  { label: "8月", value: 22 },
]

const DEMO_STACK_ROWS = [
  { label: "項目群組 A", segments: [{ key: "已完成", value: 5 }, { key: "進行中", value: 2 }, { key: "待處理", value: 1 }] },
  { label: "項目群組 B", segments: [{ key: "已完成", value: 3 }, { key: "進行中", value: 3 }, { key: "待處理", value: 2 }] },
  { label: "項目群組 C", segments: [{ key: "已完成", value: 6 }, { key: "待處理", value: 1 }] },
]

const DEMO_RANK_ROWS = [
  { label: "來源 A", value: 24 },
  { label: "來源 B", value: 18 },
  { label: "來源 C", value: 12 },
  { label: "來源 D", value: 9 },
  { label: "來源 E", value: 4 },
  { label: "來源 F", value: 3 },
]

const DEMO_AUDIT_ENTRIES: AuditEntry[] = [
  {
    id: "demo-1",
    actorId: "user-1",
    actorEmail: "admin@example.com",
    action: "item.created",
    targetType: "item",
    targetId: "00000000-demo-item-1",
    metadata: { label: "示範項目 A" },
    createdAt: new Date(Date.now() - 15 * 60_000),
  },
  {
    id: "demo-2",
    actorId: "user-2",
    actorEmail: "editor@example.com",
    action: "item.updated",
    targetType: "item",
    targetId: "00000000-demo-item-2",
    metadata: {},
    createdAt: new Date(Date.now() - 5 * 3_600_000),
  },
]

export const metadata: Metadata = { title: "元件參考" }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-medium">{title}</h2>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border p-5">{children}</div>
    </section>
  )
}

export default async function ComponentsPage() {
  await requireAuth()
  return (
    <div className="@container/main max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">元件參考 · Component reference</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          設計系統的可重用基礎元件（E259 tokens + E260 FX）。
        </p>
      </div>

      <Section title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button size="sm">Small</Button>
        <Button size="lg" className="glow-cta shine">Glow + shine</Button>
      </Section>

      <Section title="Badges + status">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <StatusBadge tone="success" dot>Active</StatusBadge>
        <StatusBadge tone="warning" dot>Pending</StatusBadge>
        <StatusBadge tone="info" dot>Info</StatusBadge>
        <StatusBadge tone="danger" dot>Failed</StatusBadge>
        <StatusBadge tone="success" dot live>Live</StatusBadge>
      </Section>

      <Section title="Inputs">
        <Input placeholder="Email" className="max-w-xs" />
        <Input placeholder="Disabled" disabled className="max-w-xs" />
      </Section>

      <Section title="Status primitives (E338)">
        <div className="flex items-center gap-1.5">
          <StatusLight tone="success" label="運作中" />
          <span className="text-muted-foreground text-xs">運作中</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusLight tone="warning" label="待處理" pulse />
          <span className="text-muted-foreground text-xs">待處理（pulse）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusLight tone="danger" label="異常" />
          <span className="text-muted-foreground text-xs">異常</span>
        </div>
        <div className="w-40">
          <ProgressBar pct={68} tone="info" showLabel />
        </div>
        <TypeChip code="A1" name="設計監造" tone="info" />
        <TypeChip code="B3" name="鄰損鑑定" tone="warning" />
        <RoleBadge role="admin" />
        <RoleBadge role="editor" />
        <RoleBadge role="viewer" size="sm" />
      </Section>

      <Section title="Filter chips (E338)">
        <FilterChipShowcase />
      </Section>

      <div>
        <h2 className="text-base font-medium">Section cards (dashboard-01 demo)</h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">
          原 dashboard-01 拼貼卡片組——首頁已改用真數字的 StatCardRow，這份展示保留在此供參考。
        </p>
        <SectionCards totalItems={128} totalUsers={45_678} verifiedUsers={1_234} />
      </div>

      <section className="space-y-6">
        <div>
          <h2 className="text-base font-medium">Dashboard widget kit（E337，領域中立）</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            components/dashboard/* — 10 個元件，props 只吃 primitive / 泛型結構，換掉資料來源即可用於任何 fork。以下為示範資料。
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-muted-foreground text-sm font-medium">GreetingHeader</h3>
          <div className="rounded-xl border p-5">
            <GreetingHeader name="測試使用者" today="2026-08-22" statLabel="共 12 個項目" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-muted-foreground text-sm font-medium">StatCard + StatCardRow</h3>
          <StatCardRow>
            <StatCard tone="info" label="總項目數" value={12} href="#" ariaLabel="總項目數 12" />
            <StatCard tone="info" label="已編輯" value={5} href="#" ariaLabel="已編輯 5" />
            <StatCard tone="muted" label="未編輯" value={7} href="#" ariaLabel="未編輯 7" />
            <StatCard tone="warning" label="逾期" value={2} hint="需要注意" href="#" ariaLabel="逾期 2" />
          </StatCardRow>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TrendChart title="新增項目趨勢（示範）" data={DEMO_TREND} valueLabel="新增項目" />
          <StackChart title="項目群組 × 狀態分佈（示範）" rows={DEMO_STACK_ROWS} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RankChart title="排行榜（示範）" rows={DEMO_RANK_ROWS} topN={4} />
          <UpcomingCard
            title="即將到期（示範）"
            emptyText="14 天內沒有到期項目"
            rows={[
              { id: "u1", label: "示範項目 C 到期", dateLabel: "08-25", overdue: false, href: "#" },
              { id: "u2", label: "示範項目 D 到期", dateLabel: "逾 2 天", overdue: true, href: "#" },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AttentionCard
            title="需要注意的項目（示範）"
            emptyText="目前沒有需要注意的項目"
            groups={[
              {
                tone: "warning",
                heading: "建立後尚未更新",
                rows: [
                  { id: "a1", label: "示範項目 A", meta: "建立後 5 天未更新", href: "#" },
                  { id: "a2", label: "示範項目 B", meta: "建立後 3 天未更新", href: "#" },
                ],
              },
            ]}
          />
          <ActivityCard title="系統動態（示範）" entries={DEMO_AUDIT_ENTRIES} emptyText="尚無系統動態" />
        </div>
      </section>

      <Section title="Surfaces + FX">
        <div className="kpi w-44 rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">KPI wash</p>
          <p className="tnum mt-1 text-2xl font-semibold">8,942</p>
          <p className="text-success text-xs">+3.1%</p>
        </div>
        <div className="lift w-44 rounded-xl border bg-card p-4">
          <span className="icon-tile icon-tile-brand mb-2">★</span>
          <p className="text-sm font-medium">Lift card</p>
          <p className="text-muted-foreground text-xs">hover me</p>
        </div>
        <p className="shimmer-text text-2xl font-bold">Shimmer text</p>
      </Section>

      <Separator />
      <p className="text-muted-foreground text-xs">
        ⌘K 開啟命令面板 · 按 <kbd className="bg-muted rounded border px-1.5 font-mono text-[10px]">d</kbd> 切換深色模式
      </p>
    </div>
  )
}
