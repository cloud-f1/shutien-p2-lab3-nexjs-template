# E261 — Cobalt Landing Redesign

**Phase:** 60 | **Status:** ⬜ | **Depends:** E259, E260

## Problem

Our Phase 58 landing (`components/marketing/*`) is functional but basic. The Cobalt design has a premium, conversion-grade marketing page (Linear/Stripe-leaning) we want to adopt — **brand-neutral**, not the literal "Cobalt" product.

## Solution

Rebuild the marketing components to the Cobalt structure + aesthetic using shadcn components, E259 tokens, and E260 FX. Keep copy generic/placeholder and 繁中-i18n-ready; do not hardcode "Cobalt".

## Key Files

- `next-app/components/marketing/hero.tsx` — aurora bg + shimmer accent phrase + "New" pill + trust row + product-preview mockup
- `next-app/components/marketing/{features,pricing,faq,cta,marketing-nav,marketing-footer}.tsx`
- `next-app/components/marketing/social-proof.tsx` (new) — logo marquee + count-up stats
- `next-app/app/(marketing)/page.tsx` — assemble sections with anchor IDs
- (ref: `/tmp/cobalt-design/ai-app/project/cobalt/app/landing.jsx`, `landing2.jsx`, `data.jsx`)

## Implementation

1. **Hero** — `.aurora` blobs, `.shimmer-text` on the accent phrase, "New" pill, dual CTA (primary `.glow-cta` + outline "Watch demo"), trust row (checks), inline product-preview mock.
2. **Social proof** — `.marquee` logo strip + count-up stats (E260 hook).
3. **Features** — 6-card grid with `.icon-tile-brand` tiles + `.lift` hover.
4. **Pricing** — monthly/yearly toggle (segmented) + 4 tiers (highlight popular) + comparison rows.
5. **FAQ** — accordion (shadcn). **CTA band** — aurora + glow. **Footer** — columns + newsletter.
6. Wire smooth-scroll nav anchors; respect dark mode; keep all copy in the i18n layer.

## Acceptance Criteria

- [ ] `(marketing)` route renders the full premium landing in light + dark.
- [ ] No hardcoded "Cobalt" brand; copy flows through the existing i18n approach.
- [ ] Uses shadcn components + E259 tokens + E260 FX (no inline color styles).
- [ ] `pnpm build` + lint + typecheck green; existing marketing test updated if present.

## Out of Scope

- Real video for "Watch demo" (modal stub ok). Dashboard polish (E262).
