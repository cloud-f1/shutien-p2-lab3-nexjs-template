"use client"

import { useTransition } from "react"
import { Bell, CheckCheck } from "lucide-react"

import { markAllRead, markRead } from "@/actions/notifications"
import type { Notification } from "@/lib/schema"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function NotificationsMenu({
  notifications,
  unreadCount,
}: {
  notifications: Notification[]
  unreadCount: number
}) {
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="通知">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="bg-destructive absolute top-1.5 right-1.5 size-2 rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          通知
          {unreadCount > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => void markAllRead())}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-normal"
            >
              <CheckCheck className="size-3.5" /> 全部已讀
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">目前沒有通知。</p>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-0.5 py-2"
              onSelect={(e) => {
                if (n.readAt) return
                e.preventDefault()
                startTransition(() => void markRead(n.id))
              }}
            >
              <div className="flex w-full items-center gap-2">
                {!n.readAt && <span className="bg-primary size-1.5 rounded-full" />}
                <span className="text-sm font-medium">{n.title}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {n.createdAt.toLocaleDateString()}
                </span>
              </div>
              {n.body && <span className="text-muted-foreground text-xs">{n.body}</span>}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
