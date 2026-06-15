import Link from "next/link"
import { CreditCard } from "lucide-react"

import type { ActiveSubscription } from "@/lib/billing/queries"
import { formatAmount, subscriptionStatusLabel } from "@/lib/billing/billing-utils"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"

export function BillingPanel({ active }: { active: ActiveSubscription }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-medium">帳務</h2>
        <p className="text-muted-foreground text-sm">你的方案、用量與付款紀錄。</p>
      </div>

      {/* Plan summary */}
      {active ? (
        <div className="rounded-xl border p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs">目前方案</p>
              <p className="tnum mt-1 text-2xl font-semibold">
                {formatAmount(active.plan.amount, active.plan.currency)}
                <span className="text-muted-foreground text-sm font-normal">/{active.plan.interval}</span>
              </p>
            </div>
            <StatusBadge tone={subscriptionStatusLabel(active.subscription.status).tone} dot>
              {subscriptionStatusLabel(active.subscription.status).label}
            </StatusBadge>
          </div>
          {active.subscription.currentPeriodEnd && (
            <p className="text-muted-foreground mt-3 text-xs">
              本期至 {active.subscription.currentPeriodEnd.toLocaleDateString()}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border p-6 text-center">
          <CreditCard className="text-muted-foreground mx-auto mb-2 size-6" />
          <p className="text-sm font-medium">尚無使用中的方案</p>
          <p className="text-muted-foreground mb-4 text-sm">升級以解鎖更多用量與功能。</p>
          <Button asChild>
            <Link href="/#pricing">查看方案</Link>
          </Button>
        </div>
      )}

      {/* Usage meter (placeholder until usage metering exists) */}
      <div className="rounded-xl border p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">本月用量</span>
          <span className="text-muted-foreground tnum">— / —</span>
        </div>
        <div className="bg-secondary h-2 overflow-hidden rounded-full">
          <div className="bg-primary h-full w-0" />
        </div>
        <p className="text-muted-foreground mt-2 text-xs">用量計量將於後續版本接入。</p>
      </div>

      {/* Payment method + invoices (managed by the provider) */}
      <div className="text-muted-foreground rounded-xl border p-5 text-sm">
        付款方式與發票由金流商（Stripe / 綠界）管理 —— 串接 Customer Portal 後將在此顯示。
      </div>
    </div>
  )
}
