import { AppBreadcrumb } from "@/components/app-breadcrumb"
import { CommandPalette } from "@/components/command-palette"
import { NotificationsMenu } from "@/components/notifications-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { requireAuth } from "@/lib/permissions"
import { getRecentNotifications, getUnreadCount } from "@/lib/notifications"

export async function SiteHeader() {
  const session = await requireAuth()
  const [notifications, unreadCount] = await Promise.all([
    getRecentNotifications(session.user.id),
    getUnreadCount(session.user.id),
  ])

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <AppBreadcrumb />
        <div className="ml-auto flex items-center gap-1">
          <CommandPalette role={session.user.role} />
          <NotificationsMenu notifications={notifications} unreadCount={unreadCount} />
        </div>
      </div>
    </header>
  )
}
