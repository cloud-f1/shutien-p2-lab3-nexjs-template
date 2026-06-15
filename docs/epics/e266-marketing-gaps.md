# E266 — Marketing Gaps

**Phase:** 61 | **Status:** ⬜ | **Depends:** E259, E260, E261

## Problem

Phase 60's landing (E261) covered hero/social-proof/features/pricing/FAQ/CTA/footer but left Cobalt's use-cases section, testimonials, the pricing monthly/yearly toggle + comparison table, and the hero video modal.

## Solution

Fill the remaining marketing sections on top of the E261 landing, keeping brand-neutral 繁中 copy + the test-pinned `DEFAULT_PRICING_TIERS`.

## Key Files

- `next-app/components/marketing/use-cases.tsx` (new) — tabbed use-case section (`#solutions`)
- `next-app/components/marketing/testimonials.tsx` (new) — reveal cards
- `next-app/components/marketing/pricing.tsx` — add monthly/yearly toggle (segmented, client) + comparison table; keep `DEFAULT_PRICING_TIERS` shape (add `yearlyPrice` optional, additive — pricing.test stays green)
- `next-app/components/marketing/hero.tsx` — wire the "Watch demo" CTA to a video modal (shadcn `dialog`, styled placeholder)
- `next-app/app/page.tsx` — slot the new sections + nav anchors

## Implementation

1. Use-cases: tabs with per-tab copy + a mock visual; `#solutions` anchor.
2. Testimonials: 3 reveal cards (brand-neutral quotes).
3. Pricing: client toggle switching monthly↔yearly display (additive field, no test break) + a feature comparison table.
4. Hero video modal: dialog with the product-preview as poster + play overlay.

## Acceptance Criteria

- [ ] Use-cases + testimonials render; pricing toggle switches periods; comparison table present.
- [ ] `pricing.test.ts` still passes (DEFAULT_PRICING_TIERS shape preserved).
- [ ] Hero "Watch demo" opens the modal; reduced-motion safe.
- [ ] `pnpm build` + lint + typecheck + unit green.

## Out of Scope

- Real demo video asset. Backend (Phase 62).
