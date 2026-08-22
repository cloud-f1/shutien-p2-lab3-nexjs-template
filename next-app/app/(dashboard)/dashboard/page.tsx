import { ChartAreaInteractiveLazy } from "@/components/chart-area-interactive-lazy"
import { ActivityCard } from "@/components/dashboard/activity-card"
import { AttentionCard } from "@/components/dashboard/attention-card"
import { GreetingHeader } from "@/components/dashboard/greeting-header"
import { StatCard } from "@/components/dashboard/stat-card"
import { StatCardRow } from "@/components/dashboard/stat-card-row"
import { OnboardingChecklist } from "@/components/onboarding-checklist"
import { Button } from "@/components/ui/button"
import { getAuditLog } from "@/lib/audit"
import { db } from "@/lib/db"
import { canEdit, isAdmin, requireAuth } from "@/lib/permissions"
import { itemsTable, usersTable } from "@/lib/schema"
import { cn } from "@/lib/utils"
import { desc, eq, isNotNull } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "儀表板" }

// Greeting/date timezone — must match `GreetingHeader`'s own default so the
// "today" string handed in and the greeting it computes agree near midnight.
const TIMEZONE = "Asia/Taipei"

// An item that hasn't been edited (updatedAt === createdAt) for at least
// this many days shows up in the "needs attention" card as stale.
const STALE_DAYS = 3

export default async function DashboardPage() {
  const session = await requireAuth()
  const userId = session.user.id
  const admin = isAdmin(session.user.role)
  const editable = canEdit(session.user.role)

  // Real data, one Promise.all (no waterfall). Admin-only queries
  // (verifiedUsers, the audit log) stay conditional.
  const [items, verifiedUsers, auditEntries, onboardingRows] = await Promise.all([
    db
      .select({ id: itemsTable.id, title: itemsTable.title, createdAt: itemsTable.createdAt, updatedAt: itemsTable.updatedAt })
      .from(itemsTable)
      .where(eq(itemsTable.userId, userId))
      .orderBy(desc(itemsTable.createdAt)),
    admin
      ? db.$count(usersTable, isNotNull(usersTable.emailVerified))
      : Promise.resolve(undefined),
    admin ? getAuditLog(8) : Promise.resolve([]),
    db
      .select({
        onboardingCompletedAt: usersTable.onboardingCompletedAt,
        onboardingDismissed: usersTable.onboardingDismissed,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId)),
  ])

  const onboardingState = {
    completed: onboardingRows[0]?.onboardingCompletedAt != null,
    dismissed: onboardingRows[0]?.onboardingDismissed ?? false,
  }

  // Derived stat-card counts. `edited` mirrors the exact semantics the items
  // list (E338) uses: "saved again since creation" — not "content differs."
  const totalItems = items.length
  const editedCount = items.filter((i) => i.updatedAt.getTime() !== i.createdAt.getTime()).length
  const newCount = totalItems - editedCount

  // Stale = never edited AND created at least STALE_DAYS ago — a real item
  // sitting untouched, worth a nudge. This is a Server Component that runs
  // once per request (no client re-render to worry about), so reading the
  // clock here is safe — the React Compiler's purity lint can't see the
  // Server/Client boundary and flags it as if this were a client render.
  // eslint-disable-next-line react-hooks/purity -- Server Component, request-time read is intentional
  const now = Date.now()
  const staleRows = items
    .filter((i) => i.updatedAt.getTime() === i.createdAt.getTime())
    .map((i) => ({ ...i, ageDays: Math.floor((now - i.createdAt.getTime()) / 86_400_000) }))
    .filter((i) => i.ageDays >= STALE_DAYS)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 5)
    .map((i) => ({
      id: i.id,
      label: i.title,
      meta: `建立後 ${i.ageDays} 天未更新`,
      href: `/dashboard/items?edit=${i.id}`,
    }))

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 lg:px-6">
            <GreetingHeader
              name={session.user.name ?? "您"}
              today={today}
              timezone={TIMEZONE}
              statLabel={`共 ${totalItems} 個項目`}
              className="min-w-0 flex-1"
            />
            {editable && (
              <Button asChild>
                <Link href="/dashboard/items?new=1">+ 新增項目</Link>
              </Button>
            )}
          </div>

          <OnboardingChecklist serverState={onboardingState} />

          <div className="px-4 lg:px-6">
            <StatCardRow>
              <StatCard tone="info" label="總項目數" value={totalItems} href="/dashboard/items" />
              <StatCard
                tone="info"
                label="已編輯"
                value={editedCount}
                href="/dashboard/items?status=edited"
              />
              <StatCard
                tone="muted"
                label="未編輯"
                value={newCount}
                href="/dashboard/items?status=new"
              />
              {admin && (
                <StatCard
                  tone="success"
                  label="已驗證使用者"
                  value={verifiedUsers ?? 0}
                  href="/dashboard/admin"
                />
              )}
            </StatCardRow>
          </div>

          <div className="px-4 lg:px-6">
            <ChartAreaInteractiveLazy />
          </div>

          {/* Non-admins only get AttentionCard (ActivityCard reads the audit
              log, which is admin-only — see lib/nav.ts's "system" item
              comment). Rather than show a permanently-disabled placeholder
              tile to the majority of users, the grid simply doesn't reserve
              space for it: AttentionCard takes the full row. */}
          <div className={cn("grid grid-cols-1 gap-4 px-4 lg:px-6", admin && "lg:grid-cols-2")}>
            <AttentionCard
              title="需要注意的項目"
              groups={[{ tone: "warning", heading: "建立後尚未更新", rows: staleRows }]}
              emptyText="目前沒有需要注意的項目"
            />
            {admin && (
              <ActivityCard title="系統動態" entries={auditEntries} emptyText="尚無系統動態" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
