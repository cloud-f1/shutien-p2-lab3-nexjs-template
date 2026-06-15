"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { acceptInvitation } from "@/actions/team"
import { Button } from "@/components/ui/button"

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onAccept() {
    setError(null)
    startTransition(async () => {
      const res = await acceptInvitation(token)
      if (res.error) setError(res.error)
      else router.push("/dashboard")
    })
  }

  return (
    <div className="mt-6 space-y-2">
      <Button onClick={onAccept} disabled={pending} className="w-full">
        {pending ? "處理中…" : "接受邀請"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
