import type { Metadata } from "next"

import { requireAuth } from "@/lib/permissions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { StatusLight } from "@/components/status-light"
import { ProgressBar } from "@/components/progress-bar"
import { TypeChip } from "@/components/type-chip"
import { RoleBadge } from "@/components/role-badge"
import { FilterChipShowcase } from "./_filter-chip-showcase"

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
    <div className="max-w-3xl space-y-8 p-6">
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
