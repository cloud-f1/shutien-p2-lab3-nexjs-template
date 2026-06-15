import type { AuditEntry } from "@/lib/audit"
import { StatusBadge } from "@/components/status-badge"

export function AuditPanel({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-medium">稽核紀錄</h2>
        <p className="text-muted-foreground text-sm">敏感操作的紀錄（角色變更、金鑰撤銷、邀請等）。僅管理員可見。</p>
      </div>
      <div className="rounded-xl border">
        {entries.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">尚無稽核紀錄。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="p-3 font-medium">操作</th>
                <th className="p-3 font-medium">執行者</th>
                <th className="p-3 font-medium">對象</th>
                <th className="p-3 font-medium">時間</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-3">
                    <StatusBadge tone="info" className="mono">{e.action}</StatusBadge>
                  </td>
                  <td className="text-muted-foreground p-3">{e.actorEmail ?? "系統"}</td>
                  <td className="text-muted-foreground mono p-3 text-xs">
                    {e.targetType ? `${e.targetType}${e.targetId ? `:${e.targetId.slice(0, 8)}` : ""}` : "—"}
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">{e.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
