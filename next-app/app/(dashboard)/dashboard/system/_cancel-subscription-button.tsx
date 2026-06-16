"use client"

/**
 * Cancel-subscription button (E274) — opens the reusable ConfirmDialog and calls
 * the owner-scoped `cancelSubscription` server action. Cancels at period end by
 * default so the user keeps access until the paid period ends; on success the
 * dialog closes and the list refreshes via revalidatePath + router.refresh().
 */
import { useState } from "react"
import { useRouter } from "next/navigation"

import { cancelSubscription } from "@/actions/billing"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"

export function CancelSubscriptionButton({
  subscriptionId,
  periodEndLabel,
}: {
  subscriptionId: string
  /** Localized renewal date string to mention in the confirm copy, if known. */
  periodEndLabel?: string | null
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        取消訂閱
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="取消訂閱"
        description={
          periodEndLabel
            ? `訂閱將於本期結束（${periodEndLabel}）後停止，在此之前你仍可繼續使用。確定要取消嗎？`
            : "訂閱將於本期結束後停止，在此之前你仍可繼續使用。確定要取消嗎？"
        }
        confirmLabel="確定取消"
        cancelLabel="保留方案"
        destructive
        onConfirm={async () => {
          const res = await cancelSubscription(subscriptionId)
          if (res.error) return { error: res.error }
          router.refresh()
        }}
      />
    </>
  )
}
