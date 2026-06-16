# Dashboard Demo

The dashboard is the post-login home screen. It provides the sidebar layout and navigation for all `@saas` modules.

**Route:** `/dashboard` · **Auth required:** Yes (any role)

## Live Demo

> Sign in at the [landing page demo](/demo/landing) first, then the dashboard iframe will show your session.

<DemoIframe path="/dashboard" title="Dashboard — Live Demo" :height="600" />

## Layout Structure

The dashboard uses a collapsible sidebar layout:

```
app/(dashboard)/
  layout.tsx          → sidebar + content area
  dashboard/
    page.tsx          → dashboard home (overview)
    settings/
      page.tsx        → account settings (@saas/account)
    admin/
      page.tsx        → admin panel (@saas/admin)
```

## Navigation

The sidebar is configured in `components/app-sidebar.tsx`. After installing modules, wire them into the nav:

```ts
// app-sidebar.tsx — add to navMain items
{
  title: 'Settings',
  url: '/dashboard/settings',
  icon: Settings,
}
```

## RBAC in Dashboard

The sidebar conditionally shows admin links based on role:

```tsx
{isAdmin(session.user.role) && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild>
      <Link href="/dashboard/admin">Admin</Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```
