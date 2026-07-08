"use client"

// E323 — Fixed bottom mobile tab bar (<768px). On desktop it renders null (the
// sidebar takes over). Role-filtered against the template's dashboard routes, and
// safe-area aware (respects the iOS home-indicator inset).
//
// z-index lesson (carried from the fork): the tab bar MUST sit BELOW modal/sheet
// footers — it uses z-40 (above page content, below the Dialog/Sheet z-50). Bumping
// it to z-100 hides the mobile modal's footer buttons behind the bar.
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package, Settings, ShieldCheck, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { isAdmin } from "@/lib/is-admin"
import type { Role } from "@/lib/schema"

interface TabItem {
  id: string
  href: string
  label: string
  icon: LucideIcon
  /** Only render for admins (e.g. the admin panel). */
  adminOnly?: boolean
}

const TABS: TabItem[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "items", href: "/dashboard/items", label: "Items", icon: Package },
  { id: "admin", href: "/dashboard/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
  { id: "settings", href: "/dashboard/settings", label: "Settings", icon: Settings },
]

export interface MobileTabBarProps {
  role: Role | string | undefined
  className?: string
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(href + "/")
}

export function MobileTabBar({ role, className }: MobileTabBarProps) {
  const isMobile = useIsMobile()
  const pathname = usePathname()

  if (!isMobile) return null

  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin(role))

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
        const active = isActive(pathname, item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[52px] flex-1 flex-col items-center gap-[3px] px-0 pb-[7px] pt-2",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon size={20} />
            <span className={cn("text-[10.5px]", active ? "font-bold" : "font-medium")}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
