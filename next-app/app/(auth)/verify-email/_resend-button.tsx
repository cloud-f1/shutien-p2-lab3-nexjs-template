"use client"

import { useState, useTransition } from "react"
import { resendVerificationEmail } from "@/actions/auth"
import { Button } from "@/components/ui/button"

export function ResendButton({ email }: { email: string }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  function handleResend() {
    startTransition(async () => {
      const result = await resendVerificationEmail(email)
      if (result.error) {
        setIsSuccess(false)
        setMessage(result.error)
      } else {
        setIsSuccess(true)
        setMessage("驗證信已寄出！")
      }
    })
  }

  return (
    <div className="space-y-2">
      {message && (
        <p
          role={isSuccess ? "status" : "alert"}
          className={`text-sm ${isSuccess ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
        >
          {message}
        </p>
      )}
      <Button variant="outline" onClick={handleResend} disabled={isPending}>
        {isPending ? "寄送中…" : "重新寄送驗證信"}
      </Button>
    </div>
  )
}
