// E339 — route-segment `not-found.tsx` for the item detail page. Next.js
// renders this (nested inside the dashboard layout, so the sidebar/header
// stay put) whenever `page.tsx` calls `notFound()` — a missing id AND the
// IDOR case (non-owner, non-admin) both land here, deliberately
// indistinguishable from each other so this page can't be used to probe
// whether a given id exists.
import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "找不到項目" }

export default function ItemNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
      <p className="text-muted-foreground text-6xl font-bold">404</p>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">找不到項目</h1>
        <p className="text-muted-foreground text-sm">此項目不存在，或您沒有權限檢視。</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard/items">返回項目列表</Link>
      </Button>
    </div>
  )
}
