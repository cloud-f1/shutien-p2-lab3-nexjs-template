# Landing Page Demo

The `@saas/landing` module provides a public marketing landing page with Hero, Features, Pricing, FAQ, and CTA sections.

**Module:** `@saas/landing` · **Route:** `/` · [Docs](/modules/landing) · [Install Guide](/modules/landing#installation)

## Live Demo

<DemoIframe path="/" title="Landing Page — Live Demo" :height="600" />

## Sections

| Section | Component | Description |
|---------|-----------|-------------|
| Navigation | `marketing-nav.tsx` | Top nav with logo, links, CTA button |
| Hero | `hero.tsx` | Headline, subtext, primary + secondary CTA |
| Features | `features.tsx` | Feature grid with icons |
| Pricing | `pricing.tsx` | Tiered pricing cards with billing toggle |
| FAQ | `faq.tsx` | Accordion-style FAQ |
| CTA | `cta.tsx` | Bottom call-to-action banner |
| Footer | `marketing-footer.tsx` | Links + copyright |

## API Demo

The landing module includes a demo route handler at `/api/demo/landing`:

<ApiPlayground
  defaultEndpoint="/api/demo/landing"
  defaultMethod="GET"
  liveAppPath="/"
/>

## Customization

After installing, update:
1. **Branding:** Edit site name in `components/marketing/marketing-nav.tsx`
2. **Pricing tiers:** Update `DEFAULT_PRICING_TIERS` in `components/marketing/pricing.tsx`
3. **Feature list:** Edit `features.tsx` to match your product
4. **Hero copy:** Update headline and CTA text in `hero.tsx`
