"use client"

/**
 * E330 — admin-only management surface for SYSTEM-scoped webhooks (CRM egress).
 * These endpoints receive site-wide `order.completed` events. CRUD follows the
 * project modal convention (E273): create via a Dialog, delete via ConfirmDialog.
 * Only rendered for admins (the parent tab is gated) and every action re-checks
 * `requireAdmin()` server-side, so this panel is defense-in-depth, not the gate.
 */
import { useState, useTransition } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Webhook } from "lucide-react"

import {
  createSystemWebhook,
  deleteSystemWebhook,
  sendSystemTestEvent,
  setSystemWebhookActive,
} from "@/actions/webhooks"
import type { SafeWebhook } from "@/lib/webhooks"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table-generic"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SystemWebhooksPanel({ webhooks }: { webhooks: SafeWebhook[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [deleteId, setDeleteId] = useState<string | null>(null)

  function onCreate() {
    setError(null)
    startTransition(async () => {
      const res = await createSystemWebhook({ url, events: ["order.completed"] })
      if (res.error) {
        setError(res.error)
        return
      }
      setSecret(res.secret ?? null)
      setUrl("")
      setCreateOpen(false)
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
            onClick={() => startTransition(() => void sendSystemTestEvent(row.original.id))}
          >
            測試
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(
                () => void setSystemWebhookActive(row.original.id, !row.original.active),
              )
            }
          >
            {row.original.active ? "停用" : "啟用"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setDeleteId(row.original.id)}
          >
            刪除
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">系統 Webhooks</h2>
          <p className="text-muted-foreground text-sm">
            系統級端點接收全站事件（如 <code className="mono">order.completed</code>）以串接 CRM。
            payload 含買家個資，端點 URL 視同機密。
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Webhook className="size-4" /> 新增系統端點
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>新增系統端點</DialogTitle>
              <DialogDescription>
                訂閱 <code className="mono">order.completed</code>。簽章密鑰只會顯示一次。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="system-webhook-url">端點 URL</Label>
              <Input
                id="system-webhook-url"
                placeholder="https://hook.make.com/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={pending}>
                取消
              </Button>
              <Button onClick={onCreate} disabled={pending || !url.trim()}>
                建立
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
        filterPlaceholder="搜尋系統端點…"
        emptyLabel="尚無系統 Webhook 端點。"
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="刪除系統端點？"
        description="此端點將停止接收全站事件，且無法復原。"
        confirmLabel="刪除"
        destructive
        onConfirm={async () => {
          if (!deleteId) return
          const res = await deleteSystemWebhook(deleteId)
          if (res.error) return res
          setDeleteId(null)
        }}
      />
    </div>
  )
}
