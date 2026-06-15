"use client"

import { useState, useTransition } from "react"
import { Webhook } from "lucide-react"

import {
  createWebhook,
  deleteWebhook,
  sendTestEvent,
  setWebhookActive,
} from "@/actions/webhooks"
import type { SafeWebhook } from "@/lib/webhooks"
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

      <div className="rounded-xl border">
        {webhooks.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">尚無 Webhook 端點。</p>
        ) : (
          <ul className="divide-y">
            {webhooks.map((w) => (
              <li key={w.id} className="flex items-center gap-3 p-3">
                <Webhook className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{w.url}</p>
                  <p className="text-muted-foreground mono text-xs">
                    {w.events.join(", ")} · 建立於 {w.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {w.active ? (
                    <StatusBadge tone="success" dot>
                      使用中
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="muted">已停用</StatusBadge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => startTransition(() => void sendTestEvent(w.id))}
                  >
                    測試
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => startTransition(() => void setWebhookActive(w.id, !w.active))}
                  >
                    {w.active ? "停用" : "啟用"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => startTransition(() => void deleteWebhook(w.id))}
                  >
                    刪除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
