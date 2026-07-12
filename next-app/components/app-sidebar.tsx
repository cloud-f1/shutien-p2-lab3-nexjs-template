"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { isAdmin, canEdit } from "@/lib/is-admin"
import { APP_NAME, APP_VERSION } from "@/lib/branding"
import { Logo } from "@/components/logo"
import Link from "next/link"
import {
  LayoutDashboardIcon,
  LibraryIcon,
  ListIcon,
  MegaphoneIcon,
  Settings2Icon,
  ShieldIcon,
  ServerIcon,
} from "lucide-react"

export interface AppSidebarUser {
  name: string
  email: string
  image: string | null
  role: string | undefined
}

export function AppSidebar({
  user,
  ...props
}: { user: AppSidebarUser } & React.ComponentProps<typeof Sidebar>) {
  const navMain = [
    { title: "儀表板", url: "/dashboard", icon: <LayoutDashboardIcon /> },
    { title: "項目", url: "/dashboard/items", icon: <ListIcon /> },
    { title: "內容庫", url: "/dashboard/library", icon: <LibraryIcon /> },
    { title: "設定", url: "/dashboard/settings", icon: <Settings2Icon /> },
    { title: "系統", url: "/dashboard/system", icon: <ServerIcon /> },
    ...(isAdmin(user.role)
      ? [
          { title: "管理", url: "/dashboard/admin", icon: <ShieldIcon /> },
          { title: "銷售頁", url: "/dashboard/admin/sales-pages", icon: <MegaphoneIcon /> },
        ]
      : []),
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/dashboard">
                <Logo className="size-6!" />
                <span className="text-base font-semibold">{APP_NAME}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} canCreate={canEdit(user.role)} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
        <span className="px-2 pb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          v{APP_VERSION}
        </span>
      </SidebarFooter>
    </Sidebar>
  )
}
