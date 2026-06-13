"use client"

import { useState, useTransition } from "react"
import { resendVerificationEmail } from "@/actions/auth"
import { Button } from "@/components/ui/button"

export function ResendButton({ email }: { email: string }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function handleResend() {
    startTransition(async () => {
      const result = await resendVerificationEmail(email)
      setMessage(result.error ?? "Verification email sent!")
    })
  }

  return (
    <div className="space-y-2">
      {message && (
        <p className={`text-sm ${message.includes("sent") ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
          {message}
        </p>
      )}
      <Button variant="outline" onClick={handleResend} disabled={isPending}>
        {isPending ? "Sending…" : "Resend verification email"}
      </Button>
    </div>
  )
}
