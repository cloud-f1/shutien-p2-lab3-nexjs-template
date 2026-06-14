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
