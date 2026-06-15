"use client"

import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Placeholder feed — wired to the notifications table in Phase 62 (E272).
const NOTIFICATIONS = [
  { title: "用量達 82%", body: "Pro 方案 — 本月 41k / 50k。", time: "12分鐘", unread: true },
  { title: "新成員加入", body: "Sara 已接受邀請。", time: "1小時", unread: true },
  { title: "工作流程失敗", body: "合約審閱逾時。", time: "4小時", unread: false },
]

export function NotificationsMenu() {
  const unread = NOTIFICATIONS.filter((n) => n.unread).length
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="通知">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="bg-destructive absolute top-1.5 right-1.5 size-2 rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          通知
          {unread > 0 && (
            <span className="text-muted-foreground text-xs font-normal">{unread} 則未讀</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {NOTIFICATIONS.map((n) => (
          <DropdownMenuItem key={n.title} className="flex flex-col items-start gap-0.5 py-2">
            <div className="flex w-full items-center gap-2">
              {n.unread && <span className="bg-primary size-1.5 rounded-full" />}
              <span className="text-sm font-medium">{n.title}</span>
              <span className="text-muted-foreground ml-auto text-xs">{n.time}</span>
            </div>
            <span className="text-muted-foreground text-xs">{n.body}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
