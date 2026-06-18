"use client"

import { useState, useTransition } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Webhook } from "lucide-react"

import {
  createWebhook,
  deleteWebhook,
  sendTestEvent,
  setWebhookActive,
} from "@/actions/webhooks"
import type { SafeWebhook } from "@/lib/webhooks"
import { DataTable } from "@/components/data-table-generic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/status-badge"

export function WebhooksPanel({ webhooks }: { webhooks: SafeWebhook[] }) {
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onCreate() {
    setError(null)
    setSecret(null)
    startTransition(async () => {
      const res = await createWebhook({ url, events: ["*"] })
      if (res.error) setError(res.error)
      else {
        setSecret(res.secret ?? null)
        setUrl("")
      }
    })
  }

  const columns: ColumnDef<SafeWebhook>[] = [
    {
      accessorKey: "url",
      header: "端點 URL",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Webhook className="text-muted-foreground size-4 shrink-0" />
          <span className="truncate text-sm font-medium">{row.original.url}</span>
        </div>
      ),
    },
    {
      id: "events",
      accessorFn: (row) => row.events.join(", "),
      header: "事件",
      cell: ({ row }) => (
        <span className="text-muted-foreground mono text-xs">
          {row.original.events.join(", ")} · 建立於 {row.original.createdAt.toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => (row.active ? "使用中" : "已停用"),
      header: "狀態",
      cell: ({ row }) =>
        row.original.active ? (
          <StatusBadge tone="success" dot>
            使用中
          </StatusBadge>
        ) : (
          <StatusBadge tone="muted">已停用</StatusBadge>
        ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">操作</span>,
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => void sendTestEvent(row.original.id))}
          >
            測試
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(() => void setWebhookActive(row.original.id, !row.original.active))
            }
          >
            {row.original.active ? "停用" : "啟用"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => void deleteWebhook(row.original.id))}
          >
            刪除
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-medium">Webhooks</h2>
        <p className="text-muted-foreground text-sm">
          事件發生時，我們會以 HMAC-SHA256 簽章 POST 到你的端點。簽章密鑰只會顯示一次。
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="https://example.com/webhooks"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={onCreate} disabled={pending || !url.trim()}>
          <Webhook className="size-4" /> 新增端點
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {secret && (
        <div className="border-success/30 bg-success/10 rounded-lg border p-3">
          <p className="text-success mb-1 text-xs font-medium">
            簽章密鑰 —— 請立即複製，不會再次顯示：
          </p>
          <code className="mono text-sm break-all">{secret}</code>
        </div>
      )}

      <DataTable
        columns={columns}
        data={webhooks}
        filterPlaceholder="搜尋端點…"
        emptyLabel="尚無 Webhook 端點。"
      />
    </div>
  )
}
