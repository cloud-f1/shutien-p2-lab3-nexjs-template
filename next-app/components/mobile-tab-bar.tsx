"use client"

// E336 — Fixed bottom mobile tab bar (<768px). On desktop it renders null (the
// sidebar takes over). Items come from lib/nav.ts (the single nav data
// source) via the shared resolveNavForRole() helper — filtered to
// `inTabBar`, role-visible, with locked items dropped here (not
// shown-but-disabled like the desktop sidebar) — a 5-slot bar has no room
// for a dead entry.
//
// z-index lesson (carried from the fork, E323): the tab bar MUST sit BELOW
// modal/sheet footers — it uses z-40 (above page content, below the
// Dialog/Sheet z-50). Bumping it to z-100 hides the mobile modal's footer
// buttons behind the bar.
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { NAV_FLAT, isNavActive, resolveNavForRole } from "@/lib/nav"
import type { Role } from "@/lib/schema"

export interface MobileTabBarProps {
  role: Role | string | undefined
  className?: string
}

export function MobileTabBar({ role, className }: MobileTabBarProps) {
  const isMobile = useIsMobile()
  const pathname = usePathname()

  if (!isMobile) return null

  const tabs = resolveNavForRole(
    NAV_FLAT.filter((item) => item.inTabBar),
    role,
  )
    .filter(({ locked }) => !locked)
    .map(({ item }) => item)

  return (
    <nav
      className={cn(
        // z-40: above page content, below the Dialog/Sheet z-50 — otherwise the fixed
        // bottom bar covers a mobile modal's footer buttons.
        "fixed inset-x-0 bottom-0 z-40 flex shrink-0 border-t bg-card shadow-[0_-4px_12px_rgba(0,0,0,0.05)]",
        "pb-[env(safe-area-inset-bottom,0px)]",
        className,
      )}
    >
      {tabs.map((item) => {
        const active = isNavActive(pathname, item)
        const Icon = item.icon
        return (
          <Link
            key={item.id}
            href={item.url}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[52px] flex-1 flex-col items-center gap-[3px] px-0 pb-[7px] pt-2",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon size={20} />
            <span className={cn("text-[10.5px]", active ? "font-bold" : "font-medium")}>
              {item.short}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
