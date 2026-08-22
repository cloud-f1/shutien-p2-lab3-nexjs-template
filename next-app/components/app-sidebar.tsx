"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { SidebarCollapsePersist } from "@/components/sidebar-collapse-persist"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { canEdit } from "@/lib/is-admin"
import { APP_NAME, APP_VERSION } from "@/lib/branding"
import { NAV_GROUPS } from "@/lib/nav"
import { Logo } from "@/components/logo"
import Link from "next/link"

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
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarCollapsePersist />
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
        <NavMain groups={NAV_GROUPS} role={user.role} canCreate={canEdit(user.role)} />
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
