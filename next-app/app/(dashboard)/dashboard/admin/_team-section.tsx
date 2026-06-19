"use client"

import { useState, useTransition } from "react"
import { DownloadIcon, UserPlus } from "lucide-react"

import { exportTeam, inviteMember, revokeInvitation } from "@/actions/team"
import type { InvitationRow } from "@/lib/team"
import type { Role } from "@/lib/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"

function triggerDownload(data: string, filename: string, contentType: string) {
  const blob = new Blob([data], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const STATUS_TONE: Record<string, "success" | "warning" | "muted"> = {
  pending: "warning",
  accepted: "success",
  revoked: "muted",
}
const STATUS_LABEL: Record<string, string> = {
  pending: "待接受",
  accepted: "已接受",
  revoked: "已撤銷",
}

export function TeamSection({ invitations }: { invitations: InvitationRow[] }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("viewer")
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [pending, startTransition] = useTransition()

  async function handleExport() {
    setExporting(true)
    try {
      const result = await exportTeam()
      if (result.success) {
        triggerDownload(result.data, result.filename, result.contentType)
      }
    } finally {
      setExporting(false)
    }
  }

  function onInvite() {
    setError(null)
    setLink(null)
    startTransition(async () => {
      const res = await inviteMember({ email, role })
      if (res.error) setError(res.error)
      else {
        const origin = typeof window !== "undefined" ? window.location.origin : ""
        setLink(`${origin}/invite/${res.token}`)
        setEmail("")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">團隊邀請</h2>
          <p className="text-muted-foreground mt-1 text-sm">以電子郵件邀請成員並指定角色。</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          <DownloadIcon className="size-4" />
          {exporting ? "匯出中…" : "匯出 CSV"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          type="email"
          placeholder="person@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="max-w-xs"
        />
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger className="h-9 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">管理員</SelectItem>
            <SelectItem value="editor">編輯者</SelectItem>
            <SelectItem value="viewer">檢視者</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onInvite} disabled={pending || !email.trim()}>
          <UserPlus className="size-4" /> 寄送邀請
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {link && (
        <div className="border-success/30 bg-success/10 rounded-lg border p-3">
          <p className="text-success mb-1 text-xs font-medium">邀請連結 —— 請分享給受邀者：</p>
          <code className="mono text-sm break-all">{link}</code>
        </div>
      )}

      <div className="rounded-xl border">
        {invitations.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">尚無邀請。</p>
        ) : (
          <ul className="divide-y">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {inv.role} · 邀請於 {inv.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <StatusBadge tone={STATUS_TONE[inv.status] ?? "muted"}>
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </StatusBadge>
                  {inv.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => startTransition(() => void revokeInvitation(inv.id))}
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
