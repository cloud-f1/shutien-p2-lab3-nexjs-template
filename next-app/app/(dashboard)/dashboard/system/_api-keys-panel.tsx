"use client"

import { useState, useTransition } from "react"
import { KeyRound } from "lucide-react"

import { createApiKey, revokeApiKey } from "@/actions/api-keys"
import type { ApiKey } from "@/lib/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/status-badge"

type KeyRow = Omit<ApiKey, "hashedKey">

export function ApiKeysPanel({ keys }: { keys: KeyRow[] }) {
  const [name, setName] = useState("")
  const [created, setCreated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onCreate() {
    setError(null)
    startTransition(async () => {
      const res = await createApiKey(name)
      if (res.error) setError(res.error)
      else {
        setCreated(res.plaintext ?? null)
        setName("")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-medium">API 金鑰</h2>
        <p className="text-muted-foreground text-sm">以程式存取你的帳戶。金鑰只會在建立時顯示一次。</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="金鑰名稱（例如 prod-server）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={onCreate} disabled={pending || !name.trim()}>
          <KeyRound className="size-4" /> 建立金鑰
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {created && (
        <div className="border-success/30 bg-success/10 rounded-lg border p-3">
          <p className="text-success mb-1 text-xs font-medium">請立即複製 —— 此金鑰不會再次顯示：</p>
          <code className="mono text-sm break-all">{created}</code>
        </div>
      )}

      <div className="rounded-xl border">
        {keys.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">尚無 API 金鑰。</p>
        ) : (
          <ul className="divide-y">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 p-3">
                <KeyRound className="text-muted-foreground size-4" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{k.name}</p>
                  <p className="text-muted-foreground mono text-xs">
                    sk_{k.prefix}…· 建立於 {k.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {k.revokedAt ? (
                    <StatusBadge tone="danger">已撤銷</StatusBadge>
                  ) : (
                    <StatusBadge tone="success" dot>使用中</StatusBadge>
                  )}
                  {!k.revokedAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => startTransition(() => void revokeApiKey(k.id))}
                    >
                      撤銷
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
