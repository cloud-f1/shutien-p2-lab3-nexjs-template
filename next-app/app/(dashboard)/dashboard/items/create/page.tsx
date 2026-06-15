import { requireEditor } from "@/lib/permissions"
import { ItemForm } from "../_item-form"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "新增項目" }

export default async function CreateItemPage() {
  // Viewers are redirected to /dashboard by requireEditor().
  await requireEditor()

  return (
    <div className="max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">新增項目</h1>
        <p className="text-sm text-muted-foreground mt-1">建立一個新的項目。</p>
      </div>

      <ItemForm submitLabel="建立項目" />

      <Button asChild variant="link" className="px-0">
        <Link href="/dashboard/items">← 返回項目列表</Link>
      </Button>
    </div>
  )
}
