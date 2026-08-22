import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { MobileTabBar } from "@/components/mobile-tab-bar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { requireAuth } from "@/lib/permissions"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()
  const { name, email, image, role } = session.user

  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          user={{
            name: name ?? "使用者",
            email: email ?? "",
            image: image ?? null,
            role,
          }}
        />
        <SidebarInset className="pb-16 md:pb-0">
          <SiteHeader />
          {children}
        </SidebarInset>
        {/* E338 — was scaffolded (E323) but never mounted; content needs the
            bottom padding above so the fixed bar doesn't cover it. */}
        <MobileTabBar role={role} />
      </SidebarProvider>
    </TooltipProvider>
  )
}
