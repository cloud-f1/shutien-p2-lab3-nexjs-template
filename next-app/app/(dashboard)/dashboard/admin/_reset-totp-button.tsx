"use client"

/**
 * E310 — Admin-assisted 2FA recovery control. Clears the target user's TOTP so a
 * user locked out of their authenticator (and out of backup codes) can sign in
 * again. Uses the project ConfirmDialog convention (E273) for the destructive
 * confirmation; the server action is admin-gated + audit-logged.
 */
import { useState } from "react"

import { resetUserTotp } from "@/actions/admin"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface ResetTotpButtonProps {
  userId: string
  email: string
}

export function ResetTotpButton({ userId, email }: ResetTotpButtonProps) {
  const [open, setOpen] = useState(false)

  async function confirmReset(): Promise<{ error?: string } | void> {
    const res = await resetUserTotp(userId)
    if (res && "error" in res && res.error) return { error: res.error }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        重設 2FA
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="重設兩步驟驗證"
        description={`確定要重設 ${email} 的 2FA？這會清除其驗證器與備用碼，使用者下次登入將無需 2FA，並可重新設定。`}
        confirmLabel="重設 2FA"
        destructive
        onConfirm={confirmReset}
      />
    </>
  )
}
