import type { Metadata } from "next"

import { getAllUsers } from "@/actions/admin"
import { requireAdmin } from "@/lib/permissions"
import { listInvitations } from "@/lib/team"
import { listAllOrders, listAllSubscriptions } from "@/lib/billing/queries"

import { AdminTabs } from "./_admin-tabs"
import { MembersTab, type MemberRow } from "./_members-tab"
import { OrdersTab, type OrderRow } from "./_orders-tab"
import { SubscriptionsTab, type SubscriptionRow } from "./_subscriptions-tab"
import { TeamSection } from "./_team-section"
import { PermissionMatrix } from "./_permission-matrix"

export const metadata: Metadata = { title: "管理 — 營收後台" }

// Feed the client-side DataTable (which paginates locally) a generous cap; the
// query stays paginated for scalability (resolvePagination clamps to MAX_PAGE_SIZE).
const LIST_CAP = 500

export default async function AdminPage() {
  const session = await requireAdmin()
  const [users, invitations, ordersPage, subscriptionsPage] = await Promise.all([
    getAllUsers(),
    listInvitations(),
    listAllOrders({ pageSize: LIST_CAP }),
    listAllSubscriptions({ pageSize: LIST_CAP }),
  ])

  const members: MemberRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    emailVerified: Boolean(u.emailVerified),
    totpEnabled: u.totpEnabled,
    createdAt: u.createdAt.toLocaleDateString(),
  }))

  const orders: OrderRow[] = ordersPage.rows.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt ? o.paidAt.toISOString() : null,
  }))

  const subscriptions: SubscriptionRow[] = subscriptionsPage.rows.map((s) => ({
    ...s,
    currentPeriodEnd: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  }))

  return (
    <div className="max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">營收後台</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          會員、訂單與訂閱的全站管理台 · 共 {members.length} 位使用者
        </p>
      </div>

      <AdminTabs
        members={
          <div className="space-y-10">
            <MembersTab members={members} currentUserId={session.user.id} />
            <TeamSection invitations={invitations} />
            <PermissionMatrix />
          </div>
        }
        orders={<OrdersTab orders={orders} />}
        subscriptions={<SubscriptionsTab subscriptions={subscriptions} />}
      />
    </div>
  )
}
