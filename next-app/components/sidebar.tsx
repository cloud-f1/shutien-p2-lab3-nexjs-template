"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { handleSignOut } from "@/actions/auth"
import { isAdmin } from "@/lib/is-admin"
import type { Session } from "next-auth"

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/items", label: "Items" },
  { href: "/dashboard/settings", label: "Settings" },
]

const adminItems = [{ href: "/dashboard/admin", label: "Admin" }]

interface SidebarProps {
  user: Session["user"]
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const showAdmin = isAdmin(user.role)

  const allItems = showAdmin ? [...navItems, ...adminItems] : navItems

  return (
    <aside className="flex w-56 flex-col border-r bg-background">
      <div className="border-b px-4 py-3">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        {showAdmin && (
          <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
            admin
          </span>
        )}
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {allItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-3">
        <form action={handleSignOut}>
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
