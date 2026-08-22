// E336 — Nav SSOT (single source of truth) for all dashboard navigation.
//
// Pure data + pure functions — NO JSX, `icon` holds the LucideIcon component
// reference (not a rendered element) — so this module stays unit-testable and
// consumable from both Server and Client Components.
//
// Five call sites used to hardcode their own copy of this data (nav-main.tsx /
// app-sidebar.tsx, mobile-tab-bar.tsx, app-breadcrumb.tsx, command-palette.tsx)
// and had already drifted (missing items, dead segments, English-only labels).
// This module is now the only place a route/label literal is allowed to live.
import {
  LayoutDashboardIcon,
  LibraryIcon,
  ListIcon,
  MegaphoneIcon,
  ServerIcon,
  Settings2Icon,
  ShieldIcon,
  type LucideIcon,
} from "lucide-react"

import type { Role } from "@/lib/schema"

export interface NavItem {
  id: string
  /** Full label for the desktop sidebar / breadcrumb. */
  label: string
  /** Short label for the mobile Tab Bar. */
  short: string
  url: string
  icon: LucideIcon
  /** Path segment this item corresponds to, for breadcrumb lookups. */
  segment: string
  /** Roles for which this item renders LOCKED — visible, not clickable, tooltip explains why. */
  lockFor?: Role[]
  /** Roles for which this item renders NOTHING. */
  hideFor?: Role[]
  /** Whether this item appears in the ⌘K command palette's "前往" group. Default true. */
  inPalette?: boolean
  /** Whether this item appears in the mobile Tab Bar (5-slot budget). Default false. */
  inTabBar?: boolean
}

export interface NavGroup {
  /** Desktop sidebar group heading (hidden when the sidebar collapses to an icon rail). */
  label: string
  items: NavItem[]
}

const dashboard: NavItem = {
  id: "dashboard",
  label: "儀表板",
  short: "儀表板",
  url: "/dashboard",
  icon: LayoutDashboardIcon,
  segment: "dashboard",
  inTabBar: true,
}

const items: NavItem = {
  id: "items",
  label: "項目",
  short: "項目",
  url: "/dashboard/items",
  icon: ListIcon,
  segment: "items",
  inTabBar: true,
}

const library: NavItem = {
  id: "library",
  label: "內容庫",
  short: "內容庫",
  url: "/dashboard/library",
  icon: LibraryIcon,
  segment: "library",
  inTabBar: true,
}

const settings: NavItem = {
  id: "settings",
  label: "設定",
  short: "設定",
  url: "/dashboard/settings",
  icon: Settings2Icon,
  segment: "settings",
  inTabBar: true,
}

// The system page loads for every authenticated role (requireAuth, not
// requireAdmin) — only 2 of its 5 panels (audit log, system webhooks) are
// admin-gated; API keys, webhooks, and billing render in full for
// editor/viewer against their own user-scoped data. So this stays fully
// unlocked — locking it would take away one-click access to functionality
// those roles can legitimately use.
const system: NavItem = {
  id: "system",
  label: "系統",
  short: "系統",
  url: "/dashboard/system",
  icon: ServerIcon,
  segment: "system",
  inTabBar: true,
}

const admin: NavItem = {
  id: "admin",
  label: "管理",
  short: "管理",
  url: "/dashboard/admin",
  icon: ShieldIcon,
  segment: "admin",
  hideFor: ["editor", "viewer"],
}

const salesPages: NavItem = {
  id: "sales-pages",
  label: "銷售頁",
  short: "銷售頁",
  url: "/dashboard/admin/sales-pages",
  icon: MegaphoneIcon,
  segment: "sales-pages",
  hideFor: ["editor", "viewer"],
}

// Desktop sidebar groups. Tab Bar / breadcrumb / command palette all derive
// from the flattened NAV_FLAT below — this is the only grouped view.
export const NAV_GROUPS: NavGroup[] = [
  { label: "總覽", items: [dashboard] },
  { label: "內容", items: [items, library] },
  { label: "設定", items: [settings, system] },
  { label: "管理", items: [admin, salesPages] },
]

export const NAV_FLAT: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

// `lockFor` is a documented mechanism, not dead code: no item in THIS
// template's own nav currently sets it (every real item is either fully
// open or `hideFor`-gated to admin). It exists for forks whose nav has a
// "visible but not permitted for this role" item — e.g. the reference fork
// this pattern was harvested from locks a 設定 item for its `staff` role. If
// your fork adds one, set `lockFor` on the item and every consumer below
// (via `resolveNavForRole`) already renders it correctly.

// Breadcrumb segments that exist as real routes but are deliberately NOT part
// of the nav (e.g. a dev-only component reference page reachable only by
// direct URL). Keep this list to genuinely nav-less routes — anything a user
// can navigate to belongs in NAV_FLAT instead.
const EXTRA_LABELS: Record<string, string> = {
  components: "元件",
}

// Derived from NAV_FLAT + EXTRA_LABELS — breadcrumb lookup table. Covers every
// NAV_FLAT segment by construction (see lib/nav.test.ts).
export const NAV_LABELS: Record<string, string> = {
  ...Object.fromEntries(NAV_FLAT.map((item) => [item.segment, item.label])),
  ...EXTRA_LABELS,
}

/** True when `item` should render LOCKED (visible, not clickable) for `role`. */
export function isNavLocked(item: NavItem, role?: Role | string): boolean {
  return !!item.lockFor && item.lockFor.includes(role as Role)
}

/** True when `item` should not render at all for `role`. */
export function isNavHidden(item: NavItem, role?: Role | string): boolean {
  return !!item.hideFor && item.hideFor.includes(role as Role)
}

/** Filters out hidden items for `role`; locked items are kept (still rendered, just locked). */
export function visibleNav(items: NavItem[], role?: Role | string): NavItem[] {
  return items.filter((item) => !isNavHidden(item, role))
}

export interface ResolvedNavItem {
  item: NavItem
  /** True when this item should render inert (locked) for the resolved role. */
  locked: boolean
}

/**
 * The single role-resolution entry point every nav-rendering consumer
 * (desktop sidebar, ⌘K command palette, mobile Tab Bar) calls — so lock
 * status can never silently diverge between them again. `visibleNav` alone
 * drops hidden items but says nothing about lock status; a consumer that
 * calls it directly and forgets `isNavLocked` will render a locked item as a
 * plain, fully-clickable entry (this is exactly the bug this helper exists
 * to prevent — see lib/nav.test.ts's cross-surface consistency test).
 *
 * Each consumer still decides what to DO with `locked` (sidebar/palette
 * render it inert; the Tab Bar's 5-slot budget has no room for a dead entry
 * and filters locked items out entirely) — this only guarantees they all
 * start from the same resolved status.
 */
export function resolveNavForRole(items: NavItem[], role?: Role | string): ResolvedNavItem[] {
  return visibleNav(items, role).map((item) => ({ item, locked: isNavLocked(item, role) }))
}

/**
 * `/dashboard` matches only the exact path; every other item also matches its
 * sub-paths (e.g. `/dashboard/items/123` is active under 項目).
 */
export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.url === "/dashboard") return pathname === "/dashboard"
  return pathname === item.url || pathname.startsWith(item.url + "/")
}
