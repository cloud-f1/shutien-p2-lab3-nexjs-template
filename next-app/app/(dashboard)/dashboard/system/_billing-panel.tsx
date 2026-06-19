import Link from "next/link"
import { CreditCard } from "lucide-react"

import type { ActiveSubscription } from "@/lib/billing/queries"
import { formatAmount, subscriptionStatusLabel } from "@/lib/billing/billing-utils"
import { getTierByPriceId } from "@/lib/billing/pricing"
import { resolveProviderKey } from "@/lib/billing/resolver"
import { formatUsageDisplay, getPlanLimit } from "@/lib/usage-utils"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/status-badge"

import { CancelSubscriptionButton } from "./_cancel-subscription-button"
import { ManageBillingButton } from "./_manage-billing-button"

export function BillingPanel({
  active,
  apiRequestUsage = 0,
}: {
  active: ActiveSubscription
  /** Current-month "api_request" usage (E301). */
  apiRequestUsage?: number
}) {
  const periodEndLabel = active?.subscription.currentPeriodEnd
    ? active.subscription.currentPeriodEnd.toLocaleDateString("zh-TW")
    : null
  const cancelScheduled = Boolean(active?.subscription.cancelAt)
  // Stripe-only: the Customer Portal redirect is wired only when Stripe is the
  // active provider (綠界 ECPay has no hosted portal — management stays in-app).
  const isStripe = resolveProviderKey() === "stripe"

  // E308 usage meter. Resolve the active plan's tier from its providerPriceId
  // (config/pricing.json is the source of truth); a user with no live
  // subscription is on the "free" tier. getPlanLimit returns null = unlimited,
  // which formatUsageDisplay renders as "{current} / ∞" with no Progress bar.
  const planSlug = active ? (getTierByPriceId(active.plan.providerPriceId)?.slug ?? "free") : "free"
  const usageLimit = getPlanLimit(planSlug, "api_request")
  const usage = formatUsageDisplay(apiRequestUsage, usageLimit)
  // Warning states (E308): ≥80% amber, ≥100% red — via semantic tokens, no
  // inline style. `over` recolors the label + tints the Progress track/indicator.
  const over = usage.hasLimit && usage.percent >= 100
  const near = usage.hasLimit && usage.percent >= 80 && !over

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
          {periodEndLabel && (
            <p className="text-muted-foreground mt-3 text-xs">
              {cancelScheduled ? "存取至" : "下次續訂"} {periodEndLabel}
            </p>
          )}
          {cancelScheduled && (
            <p className="text-warning mt-1 text-xs">此訂閱已排定於本期結束後取消。</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {active.subscription.status !== "canceled" && !cancelScheduled && (
              <CancelSubscriptionButton
                subscriptionId={active.subscription.id}
                periodEndLabel={periodEndLabel}
              />
            )}
            {isStripe && <ManageBillingButton />}
          </div>
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

      {/* Usage meter — current-month API requests (E301 + E308 limits). */}
      <div className="rounded-xl border p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">本月用量（API 請求）</span>
          <span
            className={cn(
              "tnum",
              over ? "text-destructive font-medium" : near ? "text-warning font-medium" : "text-muted-foreground",
            )}
          >
            {usage.label}
          </span>
        </div>
        {usage.hasLimit ? (
          <>
            <Progress
              value={usage.percent}
              className={cn(
                over
                  ? "[&>[data-slot=progress-indicator]]:bg-destructive bg-destructive/20"
                  : near
                    ? "[&>[data-slot=progress-indicator]]:bg-warning bg-warning/20"
                    : "",
              )}
            />
            {over && <p className="text-destructive mt-2 text-xs">已超過本月用量上限。</p>}
            {near && <p className="text-warning mt-2 text-xs">已接近本月用量上限。</p>}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">目前方案未設用量上限。</p>
        )}
      </div>

      {/* Payment method + invoices (managed by the provider's hosted portal) */}
      <div className="text-muted-foreground space-y-3 rounded-xl border p-5 text-sm">
        {isStripe ? (
          <>
            <p>付款方式與發票由 Stripe Customer Portal 管理。</p>
            {active && <ManageBillingButton />}
          </>
        ) : (
          <p>付款方式與發票由金流商（綠界）管理 —— 請於應用程式內管理你的訂閱。</p>
        )}
      </div>
    </div>
  )
}
