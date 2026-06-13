"use client"

import { Button } from "@/components/ui/button"
import { useEffect } from "react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report to your error-tracking service here.
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">發生錯誤</h1>
        <p className="text-sm text-muted-foreground">
          載入此頁面時發生問題，請稍後再試。
        </p>
      </div>
      <Button onClick={reset}>重試</Button>
    </div>
  )
}
