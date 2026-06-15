/**
 * Phase 60 — Cobalt Design Integration plan-alignment suite.
 *
 * Asserts every Phase 60 deliverable (E259–E262) actually landed in the tree.
 * Reads files as raw text (no import/transform) so it's fast + robust, and acts
 * as a guard against silent regressions ("make sure nothing is missing").
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")

describe("E259 — foundation tokens (globals.css)", () => {
  const css = read("./globals.css")
  it("defines semantic colors in :root and .dark", () => {
    for (const tok of ["--success", "--warning", "--info"]) {
      // present at least twice → light (:root) + dark (.dark)
      expect(css.split(tok).length, tok).toBeGreaterThanOrEqual(3)
    }
  })
  it("defines shadow + motion + spacing + mono scales", () => {
    for (const tok of ["--shadow-md", "--shadow-focus", "--dur-base", "--ease-out", "--sp-5", "--font-mono", "--radius-pill", "--header-height"]) {
      expect(css, tok).toContain(tok)
    }
  })
  it("wires the new colors into @theme inline for Tailwind utilities", () => {
    for (const map of ["--color-success", "--color-warning", "--color-info"]) {
      expect(css, map).toContain(map)
    }
  })
})

describe("E260 — premium FX layer", () => {
  const fx = read("./cobalt-fx.css")
  it("imports cobalt-fx.css from globals.css", () => {
    expect(read("./globals.css")).toContain("cobalt-fx.css")
  })
  it("defines the eye-catching FX classes", () => {
    for (const cls of [".aurora", ".shimmer-text", ".glow-cta", ".shine", ".lift", ".marquee", ".live-dot", ".float", ".rise", ".reveal", ".kpi"]) {
      expect(fx, cls).toContain(cls)
    }
  })
  it("guards motion behind prefers-reduced-motion", () => {
    expect(fx).toContain("prefers-reduced-motion: reduce")
  })
  it("use-reveal hook exports useReveal + useCountUp (SSR-safe)", () => {
    const hook = read("../hooks/use-reveal.ts")
    expect(hook).toContain("export function useReveal")
    expect(hook).toContain("export function useCountUp")
    expect(hook).toContain("prefers-reduced-motion")
  })
})

describe("E261 — landing redesign wired to /", () => {
  const page = read("./page.tsx")
  it("home page renders the marketing landing", () => {
    for (const c of ["Hero", "SocialProof", "Features", "Pricing", "Faq", "Cta", "MarketingNav", "MarketingFooter"]) {
      expect(page, c).toContain(c)
    }
    // placeholder homepage removed
    expect(page).not.toContain("專案已就緒")
  })
  it("hero uses aurora + shimmer + product preview + KPI wash", () => {
    const hero = read("../components/marketing/hero.tsx")
    for (const cls of ["aurora", "shimmer-text", "glow-cta", "kpi", "hero-in"]) {
      expect(hero, cls).toContain(cls)
    }
  })
  it("social-proof uses marquee + count-up", () => {
    const sp = read("../components/marketing/social-proof.tsx")
    expect(sp).toContain("marquee")
    expect(sp).toContain("useCountUp")
  })
  it("features use brand icon-tiles + lift", () => {
    const f = read("../components/marketing/features.tsx")
    expect(f).toContain("icon-tile-brand")
    expect(f).toContain("lift")
  })
})

describe("E262 — dashboard polish", () => {
  it("StatusBadge exposes semantic tones", () => {
    const sb = read("../components/status-badge.tsx")
    expect(sb).toContain("export function StatusBadge")
    for (const tone of ["success", "warning", "info", "danger"]) {
      expect(sb, tone).toContain(tone)
    }
  })
  it("dashboard KPI cards keep the brand wash", () => {
    const cards = read("../components/section-cards.tsx")
    expect(cards).toContain("from-primary/5")
  })
})

// ── Phase 61 — Cobalt UI surfaces (E263–E266) ──────────────────────────────
describe("E263 — app shell (⌘K + notifications + breadcrumb)", () => {
  it("command palette uses CommandDialog + ⌘K hotkey", () => {
    const cp = read("../components/command-palette.tsx")
    expect(cp).toContain("CommandDialog")
    expect(cp).toMatch(/metaKey|ctrlKey/)
  })
  it("site-header mounts all three shell affordances", () => {
    const h = read("../components/site-header.tsx")
    for (const c of ["CommandPalette", "NotificationsMenu", "AppBreadcrumb"]) {
      expect(h, c).toContain(c)
    }
  })
  it("notifications + breadcrumb components exist", () => {
    expect(read("../components/notifications-menu.tsx")).toContain("NotificationsMenu")
    expect(read("../components/app-breadcrumb.tsx")).toContain("usePathname")
  })
  it("the dashboard LAYOUT renders SiteHeader (topbar on every route, not per-page)", () => {
    // Guards the bug where SiteHeader sat in dashboard/page.tsx only, so the
    // ⌘K/notifications/breadcrumb were missing on settings/items/admin.
    expect(read("./(dashboard)/layout.tsx")).toContain("SiteHeader")
  })
})

describe("E264 — settings expansion", () => {
  it("tabbed settings reuses the profile + password forms", () => {
    const t = read("./(dashboard)/dashboard/settings/_settings-tabs.tsx")
    expect(t).toContain("Tabs")
    expect(t).toContain("ProfileForm")
    expect(t).toContain("PasswordForm")
    expect(read("./(dashboard)/dashboard/settings/page.tsx")).toContain("SettingsTabs")
  })
})

describe("E265 — auth split-screen + component reference", () => {
  it("auth layout is a split-screen with the brand panel", () => {
    const l = read("./(auth)/layout.tsx")
    expect(l).toContain("lg:grid-cols-2")
    expect(l).toContain("aurora")
  })
  it("component reference page renders primitives + StatusBadge", () => {
    const c = read("./(dashboard)/dashboard/components/page.tsx")
    expect(c).toContain("StatusBadge")
    expect(c).toContain("shimmer-text")
  })
})

describe("E266 — marketing gaps", () => {
  it("use-cases (#solutions) + testimonials + video-demo exist", () => {
    expect(read("../components/marketing/use-cases.tsx")).toContain('id="solutions"')
    expect(read("../components/marketing/testimonials.tsx")).toContain("Testimonials")
    expect(read("../components/marketing/video-demo.tsx")).toContain("Dialog")
  })
  it("pricing has a monthly/yearly toggle (DEFAULT_PRICING_TIERS preserved)", () => {
    const p = read("../components/marketing/pricing.tsx")
    expect(p).toContain("BillingPeriod")
    expect(p).toContain("DEFAULT_PRICING_TIERS")
  })
  it("landing page renders the new sections", () => {
    const page = read("./page.tsx")
    expect(page).toContain("UseCases")
    expect(page).toContain("Testimonials")
  })
})
