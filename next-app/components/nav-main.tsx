"use client"

// E336 — renders NAV_GROUPS (lib/nav.ts, the single nav data source), via the
// shared resolveNavForRole() helper so lock status can't diverge from the
// other nav-aware consumers (command palette, mobile Tab Bar). Locked items
// render a Lock icon + tooltip + aria-disabled instead of a <Link> — visible
// but not clickable, so the user knows the feature exists and who to ask for
// access. Hidden items never reach this component (resolveNavForRole drops
// them).
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CirclePlusIcon, Lock } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { isNavActive, resolveNavForRole, type NavGroup, type NavItem } from "@/lib/nav"
import type { Role } from "@/lib/schema"

export function NavMain({
  groups,
  role,
  canCreate = true,
}: {
  groups: NavGroup[]
  role: Role | string | undefined
  canCreate?: boolean
}) {
  const pathname = usePathname()

  return (
    <>
      {canCreate && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="flex items-center gap-2">
                <SidebarMenuButton
                  asChild
                  tooltip="新增項目"
                  className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                >
                  <Link href="/dashboard/items?new=1">
                    <CirclePlusIcon />
                    <span>新增項目</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
      {groups.map((group) => {
        const resolved = resolveNavForRole(group.items, role)
        if (resolved.length === 0) return null
        return (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {resolved.map(({ item, locked }) => (
                  <NavRow key={item.id} item={item} locked={locked} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </>
  )
}

function NavRow({
  item,
  locked,
  pathname,
}: {
  item: NavItem
  locked: boolean
  pathname: string
}) {
  const active = !locked && isNavActive(pathname, item)
  const Icon = locked ? Lock : item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={!locked}
        tooltip={locked ? `一般權限無法使用「${item.label}」，請聯絡管理員` : item.label}
        isActive={active}
        aria-disabled={locked || undefined}
        className={cn(
          active && "bg-primary/10 text-primary [&_svg]:text-primary",
          locked &&
            "cursor-not-allowed text-muted-foreground/70 hover:bg-transparent hover:text-muted-foreground/70",
        )}
      >
        {locked ? (
          <>
            <Icon />
            <span>{item.label}</span>
          </>
        ) : (
          <Link href={item.url}>
            <Icon />
            <span>{item.label}</span>
          </Link>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
