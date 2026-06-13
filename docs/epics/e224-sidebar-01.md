# E224 — shadcn sidebar-01

**Phase:** 54 | **Status:** 🔄 | **Depends:** none

## Problem

The current `components/sidebar.tsx` is hand-rolled. Adopt the official shadcn `Sidebar` primitive (sidebar-01) for collapsible, accessible, mobile-friendly nav.

## Solution

- `npx shadcn@latest add sidebar-01` (pulls `components/ui/sidebar.tsx` + nav sub-components).
- Replace the `(dashboard)/layout.tsx` shell with `SidebarProvider` + `AppSidebar`.
- Port RBAC: conditional Admin nav item via `isAdmin(session.user.role)`; Settings link; user menu with sign-out (`handleSignOut`).
- Keep server-side session fetch in the layout (Server Component) and pass `session.user` to the client sidebar.

## Acceptance

- [ ] Dashboard uses the shadcn Sidebar primitive (collapsible, mobile sheet)
- [ ] Admin link only shows for admins; non-admin e2e still green
- [ ] Sign-out works; settings reachable
