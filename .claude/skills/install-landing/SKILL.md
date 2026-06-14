---
name: install-landing
description: >
  Install the @saas/landing module into this project. Reads module.manifest.json,
  removes the placeholder app/page.tsx, and walks through branding customisation
  and pricing tier wiring. No env vars or DB migrations required.
  Use after: npx shadcn@latest add @saas/landing
user-invocable: true
metadata:
  author: saas-template
  version: "1.0.0"
---

# Install Landing Module

Installs the `@saas/landing` marketing landing page module after running:

```bash
npx shadcn@latest add @saas/landing
```

## Prerequisites

Ensure the registry files have been installed:

```bash
npx shadcn@latest add @saas/landing
```

This installs into:
- `components/marketing/hero.tsx`
- `components/marketing/features.tsx`
- `components/marketing/pricing.tsx`
- `components/marketing/faq.tsx`
- `components/marketing/cta.tsx`
- `components/marketing/marketing-nav.tsx`
- `components/marketing/marketing-footer.tsx`
- `app/(marketing)/layout.tsx`
- `app/(marketing)/page.tsx`

## Phase 0 — Pre-flight check

Verify files were installed:

```bash
ls components/marketing/ 2>/dev/null || echo "WARN: run npx shadcn@latest add @saas/landing first."
ls app/\(marketing\)/ 2>/dev/null || echo "WARN: marketing route group missing."
```

## Phase 1 — Read the manifest

```bash
cat registry/landing/module.manifest.json | jq .
```

Confirm `envVars` is empty (no secrets needed) and `dbTables` is empty (no migrations).

## Phase 2 — Remove the placeholder root page

The `@saas/landing` module owns the `/` route via `app/(marketing)/page.tsx`.
The default `app/page.tsx` placeholder conflicts with this route.

```bash
# Remove the placeholder (it is safe to delete — the marketing page replaces it)
rm -f next-app/app/page.tsx
echo "Removed placeholder app/page.tsx. The / route is now handled by app/(marketing)/page.tsx."
```

If you want to keep the placeholder for reference, rename it instead:

```bash
mv next-app/app/page.tsx next-app/app/page.tsx.bak
```

## Phase 3 — Customise branding

Update the site name in the nav and footer:

**`components/marketing/marketing-nav.tsx`** — change `SaaS Template` to your product name:

```tsx
// Before:
<Link href="/">SaaS Template</Link>

// After:
<Link href="/">Your Product Name</Link>
```

**`components/marketing/marketing-footer.tsx`** — update the copyright line similarly.

## Phase 4 — Update Hero copy

In `components/marketing/hero.tsx`, update the headline and sub-headline to match your product value proposition.

## Phase 5 — Wire pricing tiers (once billing is live)

When the billing adapter is configured (E232+ Stripe/ECPay), replace the static
`DEFAULT_PRICING_TIERS` in `components/marketing/pricing.tsx` with data fetched
from your `Plan` records.

Until then, the static tiers serve as a visual placeholder.

## Phase 6 — Verify

```bash
cd next-app
pnpm typecheck
pnpm lint
```

Start the dev server and visit `/` to confirm:
- Public nav (sticky header) renders
- Hero, Features, Pricing, FAQ, CTA sections render
- Dark mode toggle works (press `d`)
- Pricing CTA buttons route to `/register?plan=<plan>`
- Footer links are correct

```bash
pnpm dev
# open http://localhost:3000
```

## Post-install checklist

- [ ] `app/page.tsx` placeholder removed or archived
- [ ] Branding updated in nav + footer
- [ ] Hero copy reflects your product
- [ ] Pricing tiers reflect your actual plans (or noted as placeholder)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `/` loads the landing page in both light and dark mode
- [ ] Pricing CTAs route to `/register`
