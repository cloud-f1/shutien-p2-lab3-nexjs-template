---
name: install-landing
description: >
  Install the @saas/landing module into a project that does NOT already have a
  landing page (e.g. a fresh `create-next-app`). Reads module.manifest.json,
  replaces the bare Next.js starter app/page.tsx ONLY if it is the default
  placeholder, and walks through branding customisation and pricing tier wiring.
  No env vars or DB migrations required. NOTE: in THIS template the landing is
  already baked in (app/page.tsx + components/marketing/*) — do NOT re-install or
  delete it here. Use after: npx shadcn@latest add @saas/landing
user-invocable: true
metadata:
  author: saas-template
  version: "1.0.0"
---

# Install Landing Module

> ⚠️ **READ FIRST — this template already ships a landing page.**
> In THIS repo the landing is **baked in**: `app/page.tsx` is the *real* composed
> homepage (it renders `components/marketing/*` — Hero, SocialProof, Features,
> UseCases, Testimonials, Pricing, FAQ, CTA), and it is **newer and richer** than
> the `registry/landing/**` copy. The registry copy is a simpler, English,
> static-pricing snapshot meant for installing into a **different** project.
>
> - **In THIS template:** the landing is **already installed — do nothing.**
>   Do **NOT** run `npx shadcn@latest add @saas/landing` here, and do **NOT**
>   delete `app/page.tsx`. Re-installing would **overwrite the live homepage with
>   the older static registry copy** and drop the extra sections (SocialProof,
>   UseCases, Testimonials) — a route-collision + regression footgun.
> - **In a fresh project** (`create-next-app` with the bare starter `app/page.tsx`):
>   follow the phases below to install the landing.

Installs the `@saas/landing` marketing landing page module into a project that
does not already have one, after running:

```bash
npx shadcn@latest add @saas/landing
```

## Prerequisites

The `@saas` registry is served by the template app itself at `/r/*`. Before
`npx shadcn add @saas/landing` can fetch anything, set `SAAS_REGISTRY_URL` and have
a running registry origin:

- **Local:** `SAAS_REGISTRY_URL=http://localhost:3000` (default in `.env.example`)
  with `pnpm dev` (or `pnpm build && pnpm start`) running.
- **Deployed registry:** `SAAS_REGISTRY_URL=https://your-app.example.com`.

Then install the registry files:

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

## Phase 2 — Resolve the `/` route collision (GUARDED)

The `@saas/landing` module owns the `/` route via `app/(marketing)/page.tsx`. If
the project also has an `app/page.tsx`, Next.js sees **two pages resolving to `/`**
and the build fails with a route-collision error. How to resolve it depends on
what `app/page.tsx` actually is — **never blindly `rm` it**:

```bash
cd next-app   # run from the next-app/ root

if [ ! -f app/page.tsx ]; then
  echo "No app/page.tsx — nothing to do. app/(marketing)/page.tsx now owns /."
elif grep -q "Get started by editing" app/page.tsx; then
  # This is the bare create-next-app starter placeholder — safe to remove.
  mv app/page.tsx app/page.tsx.bak
  echo "Archived the bare Next.js starter placeholder to app/page.tsx.bak."
  echo "The / route is now handled by app/(marketing)/page.tsx."
else
  echo "STOP: app/page.tsx is NOT the bare Next.js starter — it is a REAL page."
  echo "Do NOT delete it. (In the @saas template this IS the live composed landing.)"
  echo "If you intended to install the landing into THIS template: it is already"
  echo "installed — abort this skill. Otherwise reconcile the two / routes by hand."
fi
```

**Why the guard:** in the `@saas` template, `app/page.tsx` is the real composed
homepage (renders `components/marketing/*`), not a placeholder — deleting it
removes the working site. The detection above only archives a file containing the
literal create-next-app marker (`Get started by editing`); anything else is
treated as a real page and left untouched. Resolve any remaining collision
deliberately, never by reflex deletion.

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

- [ ] No `/` route collision — bare starter `app/page.tsx` archived (NOT a real page)
- [ ] Branding updated in nav + footer
- [ ] Hero copy reflects your product
- [ ] Pricing tiers reflect your actual plans (or noted as placeholder)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `/` loads the landing page in both light and dark mode
- [ ] Pricing CTAs route to `/register`
