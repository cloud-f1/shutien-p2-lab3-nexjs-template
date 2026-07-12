"use client"

/**
 * 會員詳情 modal (E331) — CRUD/detail via modal convention (E273). Fetches the
 * member's orders + entitlements + active subscription on open via the admin-gated
 * getMemberDetail() action (the same E328 queries the entitlement guard uses), so
 * the heavy per-user joins run only when a row is actually inspected.
 */
import { useEffect, useState } from "react"

import { getMemberDetail, type MemberDetail } from "@/actions/admin-revenue"
import { formatAmount, subscriptionStatusLabel } from "@/lib/billing/billing-utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/status-badge"
import { Separator } from "@/components/ui/separator"

import { ORDER_STATUS_META } from "./_order-status"

export function MemberDetailDialog({
  open,
  onOpenChange,
  userId,
  memberEmail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string | null
  memberEmail: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<MemberDetail | null>(null)

  useEffect(() => {
    if (!open || !userId) return
    let cancelled = false
    // Keep all state writes inside the async task (not synchronous in the effect
    // body) so a single fetch drives loading → loaded/error without cascades.
    const run = async () => {
      setLoading(true)
      setError(null)
      setDetail(null)
      try {
        const res = await getMemberDetail(userId)
        if (cancelled) return
        if ("error" in res) setError(res.error)
        else setDetail(res.detail)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [open, userId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>會員詳情</DialogTitle>
          <DialogDescription>{memberEmail ?? "—"} 的訂單、權限與訂閱。</DialogDescription>
        </DialogHeader>

        {loading && <p className="text-muted-foreground py-8 text-center text-sm">載入中…</p>}
        {error && <p className="text-destructive py-8 text-center text-sm">{error}</p>}

        {detail && (
          <div className="space-y-6">
            {/* Basic info */}
            <section className="space-y-1 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20">姓名</span>
                <span>{detail.user?.name ?? "—"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20">角色</span>
                <span>{detail.user?.role ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-20">狀態</span>
                <span>{detail.user?.status ?? "—"}</span>
                {detail.user && !detail.user.hasPassword && (
                  <StatusBadge tone="warning">尚未設定密碼</StatusBadge>
                )}
              </div>
            </section>

            <Separator />

            {/* Active subscription */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium">目前訂閱</h3>
              {detail.subscription ? (
                <div className="flex items-center gap-2 text-sm">
                  <StatusBadge tone={subscriptionStatusLabel(detail.subscription.subscription.status).tone}>
                    {subscriptionStatusLabel(detail.subscription.subscription.status).label}
                  </StatusBadge>
                  <span>{detail.subscription.subscription.provider}</span>
                  <span className="text-muted-foreground">
                    {formatAmount(
                      detail.subscription.plan.amount,
                      detail.subscription.plan.currency,
                    )}
                    /{detail.subscription.plan.interval}
                  </span>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">無使用中的訂閱。</p>
              )}
            </section>

            <Separator />

            {/* Entitlements */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium">內容權限（{detail.entitlements.length}）</h3>
              {detail.entitlements.length === 0 ? (
                <p className="text-muted-foreground text-sm">尚無已開通的內容。</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {detail.entitlements.map((e) => (
                    <li key={e.id}>
                      <StatusBadge tone="success">{e.name}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator />

            {/* Orders */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium">訂單（{detail.orders.length}）</h3>
              {detail.orders.length === 0 ? (
                <p className="text-muted-foreground text-sm">尚無訂單。</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {detail.orders.map((o) => {
                    const meta = ORDER_STATUS_META[o.status]
                    return (
                      <li key={o.id} className="flex items-center gap-3 p-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{o.productName ?? "—"}</p>
                          <p className="text-muted-foreground text-xs">
                            {o.provider} · {new Date(o.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-muted-foreground">
                          {formatAmount(o.amount, o.currency)}
                        </span>
                        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
