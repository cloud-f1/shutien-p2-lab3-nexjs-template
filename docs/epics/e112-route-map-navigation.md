# E112 — ROUTE_MAP: Single Source of Truth for Navigation

> Phase 31 — Integration Integrity Shield | Size: M | Deps: none
> Learned from: ai-casino-shift E167 (nav items set state, don't navigate; pages lack sidebar when accessed by URL)

## Problem

Dashboard views use `useState<View>` + `onItemClick` to switch views within a single `/dashboard` route. Nav items are buttons that set state — not links that navigate. Pages accessed directly via URL don't show the correct sidebar state. This is the exact pattern that caused the navigation gap in casino-shift E167.

## Solution

Introduce a `ROUTE_MAP` constant as the single source of truth for both route definitions and nav items. Each dashboard view becomes a real route (`/dashboard/overview`, `/dashboard/health`, etc.). `activeItem` is derived from `useLocation().pathname`. `DashboardLayout` wraps all dashboard child routes via a layout route with `<Outlet />`.

## Key Files

| File | Action |
|------|--------|
| `client/src/config/routeMap.ts` | New — ROUTE_MAP constant |
| `client/src/App.tsx` | Refactor — nested layout route for dashboard |
| `client/src/pages/dashboard/DashboardPage.tsx` | Refactor — remove useState<View>, derive from URL |
| `client/src/components/DashboardLayout.tsx` | Refactor — derive activeItem from pathname |

## Acceptance Criteria

1. `ROUTE_MAP` maps view id to `{ path, label, icon, section }`
2. `App.tsx` generates dashboard child routes from ROUTE_MAP (no hardcoded paths)
3. `DashboardLayout` derives activeItem from `useLocation().pathname`
4. Nav items are `<NavLink>` using ROUTE_MAP paths, not state setters
5. Direct URL `/dashboard/health` renders correctly with sidebar highlighted
6. New view = add ROUTE_MAP entry + component (no other files)
7. Test verifies every ROUTE_MAP entry has a corresponding route and nav item

## Reference

- ai-casino-shift E167: `AppLayout` + `ROUTE_MAP` + `deriveActiveItem(pathname)` + `deriveBreadcrumb(pathname)`
- React Router layout routes: parent route with `<Outlet />` for nested views
