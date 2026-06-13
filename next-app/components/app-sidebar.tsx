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
import { isAdmin } from "@/lib/is-admin"
import Link from "next/link"
import {
  LayoutDashboardIcon,
  ListIcon,
  Settings2Icon,
  ShieldIcon,
  CommandIcon,
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
    { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
    { title: "Items", url: "/dashboard/items", icon: <ListIcon /> },
    { title: "Settings", url: "/dashboard/settings", icon: <Settings2Icon /> },
    ...(isAdmin(user.role)
      ? [{ title: "Admin", url: "/dashboard/admin", icon: <ShieldIcon /> }]
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
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">Acme Inc.</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
