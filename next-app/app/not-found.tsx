import { Button } from "@/components/ui/button"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "找不到頁面" }

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">找不到頁面</h1>
        <p className="text-sm text-muted-foreground">
          您要找的頁面不存在或已被移除。
        </p>
      </div>
      <Button asChild>
        <Link href="/">返回首頁</Link>
      </Button>
    </div>
  )
}
