"use client"

/**
 * Manage-billing button (E292) — opens the Stripe Customer Portal so the user can
 * update their payment method + download invoices on Stripe's hosted page.
 *
 * Stripe-only: the parent (BillingPanel) renders this only when the active
 * provider is Stripe. On success the server action returns a portal URL and we
 * redirect the browser to it (a read-only redirect — no ConfirmDialog needed).
 */
import { useState, useTransition } from "react"
import { CreditCard } from "lucide-react"

import { createPortalSession } from "@/actions/billing"
import { Button } from "@/components/ui/button"

export function ManageBillingButton() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const res = await createPortalSession()
      if (res.success && res.url) {
        window.location.href = res.url
        return
      }
      setError(res.error ?? "無法開啟帳務管理入口。")
    })
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={pending}
        data-testid="manage-billing"
      >
        <CreditCard className="size-4" />
        {pending ? "開啟中…" : "管理帳務"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
