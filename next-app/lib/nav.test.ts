import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, it, expect } from "vitest"

import {
  NAV_FLAT,
  NAV_GROUPS,
  NAV_LABELS,
  isNavActive,
  isNavHidden,
  isNavLocked,
  resolveNavForRole,
  visibleNav,
  type NavItem,
} from "./nav"

const ROLES = ["admin", "editor", "viewer"] as const
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")

describe("NAV_FLAT / NAV_GROUPS", () => {
  it("NAV_FLAT is the flattening of NAV_GROUPS", () => {
    const flattened = NAV_GROUPS.flatMap((g) => g.items)
    expect(NAV_FLAT).toEqual(flattened)
  })

  it("every item has a unique id", () => {
    const ids = NAV_FLAT.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every item has an icon component reference (not a rendered JSX element)", () => {
    for (const item of NAV_FLAT) {
      // lucide-react icons are forwardRef component objects — that's fine and
      // expected. A rendered element would additionally carry `props`/`type`
      // with $$typeof === Symbol(react.element); a component reference does not.
      expect(item.icon).not.toHaveProperty("props")
      expect(typeof item.icon === "function" || typeof item.icon === "object").toBe(true)
    }
  })
})

describe("NAV_LABELS", () => {
  it("covers every NAV_FLAT segment", () => {
    for (const item of NAV_FLAT) {
      expect(NAV_LABELS[item.segment]).toBe(item.label)
    }
  })
})

describe("isNavLocked / isNavHidden / visibleNav role matrix", () => {
  const dashboard = NAV_FLAT.find((i) => i.id === "dashboard")!
  const system = NAV_FLAT.find((i) => i.id === "system")!
  const admin = NAV_FLAT.find((i) => i.id === "admin")!
  const salesPages = NAV_FLAT.find((i) => i.id === "sales-pages")!

  it("dashboard is never locked or hidden for any role", () => {
    for (const role of ROLES) {
      expect(isNavLocked(dashboard, role)).toBe(false)
      expect(isNavHidden(dashboard, role)).toBe(false)
    }
  })

  it("system is never locked or hidden for any role (requireAuth, not requireAdmin — most panels work for editor/viewer)", () => {
    for (const role of ROLES) {
      expect(isNavLocked(system, role)).toBe(false)
      expect(isNavHidden(system, role)).toBe(false)
    }
  })

  it("no NAV_FLAT item in this template currently sets lockFor (the mechanism is reserved for forks — see the comment above NAV_FLAT in lib/nav.ts)", () => {
    for (const item of NAV_FLAT) {
      expect(item.lockFor, item.id).toBeUndefined()
    }
  })

  it("admin and sales-pages are hidden for editor/viewer, visible for admin", () => {
    for (const item of [admin, salesPages]) {
      expect(isNavHidden(item, "admin")).toBe(false)
      expect(isNavHidden(item, "editor")).toBe(true)
      expect(isNavHidden(item, "viewer")).toBe(true)
    }
  })

  it("isNavLocked/isNavHidden are false for an undefined role", () => {
    expect(isNavLocked(system, undefined)).toBe(false)
    expect(isNavHidden(admin, undefined)).toBe(false)
  })

  it("visibleNav keeps locked items but drops hidden ones, per role", () => {
    const forAdmin = visibleNav(NAV_FLAT, "admin")
    expect(forAdmin).toHaveLength(NAV_FLAT.length)

    const forEditor = visibleNav(NAV_FLAT, "editor")
    expect(forEditor.find((i) => i.id === "admin")).toBeUndefined()
    expect(forEditor.find((i) => i.id === "sales-pages")).toBeUndefined()
    // Not hidden — present regardless of lock status.
    expect(forEditor.find((i) => i.id === "system")).toBeDefined()

    const forViewer = visibleNav(NAV_FLAT, "viewer")
    expect(forViewer.find((i) => i.id === "admin")).toBeUndefined()
    expect(forViewer.find((i) => i.id === "sales-pages")).toBeUndefined()
    expect(forViewer.find((i) => i.id === "system")).toBeDefined()
  })
})

describe("resolveNavForRole", () => {
  // A synthetic locked item — the template's own nav currently has none, so
  // this is the only way to exercise the locked branch end-to-end.
  const lockedItem: NavItem = {
    id: "test-locked",
    label: "測試上鎖項目",
    short: "測試",
    url: "/dashboard/test-locked",
    icon: NAV_FLAT[0].icon,
    segment: "test-locked",
    lockFor: ["editor", "viewer"],
  }

  it("flags a locked item as locked while keeping it in the resolved set", () => {
    for (const role of ["editor", "viewer"] as const) {
      const resolved = resolveNavForRole([lockedItem], role)
      expect(resolved).toHaveLength(1)
      expect(resolved[0].item).toBe(lockedItem)
      expect(resolved[0].locked).toBe(true)
    }
  })

  it("resolves the same item as unlocked for a role not in lockFor", () => {
    const resolved = resolveNavForRole([lockedItem], "admin")
    expect(resolved).toHaveLength(1)
    expect(resolved[0].locked).toBe(false)
  })

  it("drops hidden items entirely — they never reach the resolved set", () => {
    const hiddenItem: NavItem = { ...lockedItem, id: "test-hidden", lockFor: undefined, hideFor: ["viewer"] }
    expect(resolveNavForRole([hiddenItem], "viewer")).toHaveLength(0)
    expect(resolveNavForRole([hiddenItem], "admin")).toHaveLength(1)
  })

  it("matches isNavLocked/isNavHidden for every real NAV_FLAT item and role (no drift between the two APIs)", () => {
    for (const item of NAV_FLAT) {
      for (const role of ROLES) {
        const resolved = resolveNavForRole([item], role)
        if (isNavHidden(item, role)) {
          expect(resolved).toHaveLength(0)
        } else {
          expect(resolved).toHaveLength(1)
          expect(resolved[0].locked).toBe(isNavLocked(item, role))
        }
      }
    }
  })
})

// QA regression (E336 fix round 2): the command palette originally imported
// only `visibleNav` and rendered every visible item as a plain clickable
// CommandItem — so a `lockFor` item would render inert in the sidebar but
// fully clickable in ⌘K, silently falsifying the epic's "same visible set
// across all three surfaces" acceptance criterion. Guard against that
// regression at the source level: every role-aware nav consumer must resolve
// through the same shared helper.
describe("cross-surface lock consistency", () => {
  it("sidebar, command palette, and mobile Tab Bar all resolve nav visibility/lock through resolveNavForRole (not a raw visibleNav bypass)", () => {
    const consumers = [
      "../components/nav-main.tsx",
      "../components/command-palette.tsx",
      "../components/mobile-tab-bar.tsx",
    ]
    for (const rel of consumers) {
      const src = read(rel)
      expect(src, `${rel} should call resolveNavForRole`).toContain("resolveNavForRole")
    }
  })
})

describe("isNavActive", () => {
  const dashboard = NAV_FLAT.find((i) => i.id === "dashboard")!
  const items = NAV_FLAT.find((i) => i.id === "items")!

  it("/dashboard matches only the exact path", () => {
    expect(isNavActive("/dashboard", dashboard)).toBe(true)
    expect(isNavActive("/dashboard/items", dashboard)).toBe(false)
  })

  it("other items match their own sub-paths", () => {
    expect(isNavActive("/dashboard/items", items)).toBe(true)
    expect(isNavActive("/dashboard/items/123", items)).toBe(true)
    expect(isNavActive("/dashboard/itemsfoo", items)).toBe(false)
    expect(isNavActive("/dashboard/settings", items)).toBe(false)
  })
})

describe("mobile Tab Bar item budget", () => {
  it("has at most 5 items flagged inTabBar (5-slot bar)", () => {
    const tabBarItems: NavItem[] = NAV_FLAT.filter((i) => i.inTabBar)
    expect(tabBarItems.length).toBeLessThanOrEqual(5)
    expect(tabBarItems.length).toBeGreaterThan(0)
  })
})
