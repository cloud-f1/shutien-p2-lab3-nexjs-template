import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable, type DataTableItem } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { canEdit, isAdmin, requireAuth } from "@/lib/permissions"
import { itemsTable, usersTable } from "@/lib/schema"
import { eq, isNotNull } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const session = await requireAuth()
  const userId = session.user.id
  const admin = isAdmin(session.user.role)
  const editable = canEdit(session.user.role)

  // Real data: the current user's items + total count (no waterfall).
  // Admin-only: total users and verified-user count.
  const [items, totalItems, totalUsers, verifiedUsers] = await Promise.all([
    db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.userId, userId))
      .orderBy(itemsTable.createdAt),
    db.$count(itemsTable, eq(itemsTable.userId, userId)),
    admin ? db.$count(usersTable) : Promise.resolve(undefined),
    admin
      ? db.$count(usersTable, isNotNull(usersTable.emailVerified))
      : Promise.resolve(undefined),
  ])

  // itemsTable has no status column — surface a representative status while
  // mapping the real id/title/createdAt onto the table's columns.
  const tableData: DataTableItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    status: "Done",
    createdAt: item.createdAt.toLocaleDateString(),
  }))

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="flex items-center justify-between px-4 lg:px-6">
              <div>
                <h1 className="text-xl font-semibold">
                  Welcome back, {session.user.name ?? "there"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Here is an overview of your account.
                </p>
              </div>
              {editable && (
                <Button asChild>
                  <Link href="/dashboard/items/create">+ New Item</Link>
                </Button>
              )}
            </div>
            <SectionCards
              totalItems={totalItems}
              totalUsers={totalUsers}
              verifiedUsers={verifiedUsers}
            />
            <div className="px-4 lg:px-6">
              <ChartAreaInteractive />
            </div>
            <DataTable data={tableData} canEdit={editable} />
          </div>
        </div>
      </div>
    </>
  )
}
