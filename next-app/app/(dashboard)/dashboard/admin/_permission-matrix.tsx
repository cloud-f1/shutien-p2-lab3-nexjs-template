import { Check, Minus } from "lucide-react"

import { CAPABILITIES, PERMISSION_MATRIX } from "@/lib/team-utils"
import type { Role } from "@/lib/schema"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ROLE_LABELS: Record<Role, string> = {
  admin: "管理員",
  editor: "編輯者",
  viewer: "檢視者",
}

const ROLES: Role[] = ["admin", "editor", "viewer"]

/** Read-only capability × role grid — the single source of truth is PERMISSION_MATRIX. */
export function PermissionMatrix() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">權限矩陣</h2>
        <p className="text-muted-foreground mt-1 text-sm">各角色可執行的操作。</p>
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>能力</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className="text-center">
                  {ROLE_LABELS[r]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {CAPABILITIES.map((cap) => (
              <TableRow key={cap.key}>
                <TableCell className="font-medium">{cap.label}</TableCell>
                {ROLES.map((r) => (
                  <TableCell key={r} className="text-center">
                    {PERMISSION_MATRIX[r][cap.key] ? (
                      <Check className="text-success mx-auto size-4" aria-label="允許" />
                    ) : (
                      <Minus className="text-muted-foreground mx-auto size-4" aria-label="不允許" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
