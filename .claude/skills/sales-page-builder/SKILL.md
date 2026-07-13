---
name: sales-page-builder
description: >
  Turn a single hand-off HTML one-pager (Claude-Design export, Figma export, an
  outsourced landing page) into a production `/p/[slug]` CUSTOM sales page in this
  Next.js template — with the sales mechanics (checkout, countdown, hook video,
  thank-you) auto-wired. Use when someone drops a bespoke sales/landing HTML and
  says "make this a real sales page", "turn this into a /p page", "I need a
  custom sales page for <product>", or when the E326 preset/structured system
  can't express a flagship offer's off-grid layout. Narrow, sales-page-specific
  version of mockup-to-epics + @designer + design-system — it reuses their ingest
  and token conventions, it does not reinvent them. Pairs with the three-tier
  playbook (docs/playbooks/sales-page-tiers.md) and E326/E327/E332.
user-invocable: true
---

# sales-page-builder

Convert **one hand-off HTML** into a committed, on-brand **custom** `/p/[slug]`
sales page whose CTA drives real checkout — the "tier 3" path in this template's
three-tier sales-page architecture.

> **Runtime HTML upload is out of scope, by design.** A custom page is always
> code → PR → deploy. Never render user-supplied HTML at runtime (XSS / CSP /
> token-drift risk). If someone asks for an upload-and-render feature, say no and
> point them here.

## When to use which tier (read this first)

The template has three ways to ship a sales page. Pick the cheapest that works —
full decision table in `docs/playbooks/sales-page-tiers.md`.

| Tier | What | Who edits | Use when |
|---|---|---|---|
| **1 preset** | E326 style preset (`bold`/`premium`/`clean`) + hero variant, default sections | admin (form) | Standard offer, brand-consistent look. |
| **2 structured** | DB/config `SalesPageContent` — reorder/omit the 8 AIDA sections | admin (form, E332) | Copy/section changes without a deploy. |
| **3 custom** | Hand-authored TSX registered in `lib/sales/custom-pages.ts` | engineer (code) | Flagship offer needs a bespoke, off-grid layout the section pipeline can't express. **This skill.** |

If tier 1 or 2 can express it, STOP — don't build a custom page. A custom page is
more surface to maintain.

## Inputs

- **One HTML file** (or a Claude-Design hand-off directory), and
- **the target product slug** (an E327 `products` row — the checkout binding).

## The pipeline (4 phases)

### Phase 1 — Ingest & map (reuse `mockup-to-epics` conventions)

1. **Read the HTML** (and its CSS/JS). If it's a bundle, boot it and screenshot
   like `mockup-to-epics` does — you're inventorying, not eyeballing.
2. **Extract the structure**: the ordered list of blocks (hero, social proof,
   offer, urgency, FAQ, …), the copy, and the media (images, hook video).
3. **Map colour/type to tokens**, don't copy raw values. Build a small mapping
   table: every hand-off colour → the nearest design token
   (`bg-primary`, `text-muted-foreground`, `bg-card`, `border`, …). A truly
   one-off accent that no token covers becomes a **page-scoped CSS variable** in
   the page's own module — never an inline `style=` colour and never an edit to
   the global `@theme` block. Prefer a token; escalate to a page var only when
   the brand demands it.

Deliverable of Phase 1: a block list + a colour/type → token mapping table.

### Phase 2 — Convert to TSX

Create `next-app/components/sales-pages/<slug>/page-content.tsx`.

Hard rules (the Stop-verifier and dark-mode both enforce these — breaking them
fails the build/commit):

- **No inline `style=` colour overrides.** Every colour is a token Tailwind
  utility. This is *why* dark mode "just works" — tokens flip via CSS vars.
- **`cn()` for every conditional class** — never string concatenation.
- **`next/image`** for raster art (never a bare `<img>`); give it `width/height`
  or `fill` + `sizes` (no CLS).
- **Server Component by default.** Only the pieces that need the browser
  hydrate: the countdown, the checkout button, the inline `<video>`.
- **Dark mode must not break the layout** — verify both themes.
- **Default export = the page component**, typed `SalesPageProps`. Optionally
  `export const metadata: Metadata` — the route merges it.

Skeleton:

```tsx
import type { SalesPageProps } from "@/lib/sales/custom-pages"

export const metadata = { title: "…", description: "…" }

export default function MyCustomSalesPage({ product }: SalesPageProps) {
  // product?.slug / product?.amount / product?.currency are server-owned.
  return <main className="bg-background text-foreground min-h-screen">…</main>
}
```

### Phase 3 — Wire the mechanics (never hand-roll these)

The route injects `SalesPageProps` (`slug` + the resolved E327 `product`), so you
never query prices or wire payment. Compose the shared primitives:

| Need | Use | Notes |
|---|---|---|
| CTA → checkout | `<SalesCheckoutButton productSlug={product?.slug} label="…" />` | `components/marketing/sales/checkout-button.tsx`. Collects a guest email, calls E327 `createOneTimeCheckout`, hands off to Stripe (`redirectUrl`) / ECPay (`formHtml`). `productSlug` null → auto-disabled "即將開放". |
| Urgency | `<CountdownTimer deadline={iso} accentClassName="…" />` | `components/marketing/sales/countdown-timer.tsx` (E326). Hides itself past the deadline — no fake-urgency reset. |
| Hook video | `<VideoDemo mode="inline" src poster captionsSrc />` | `components/marketing/video-demo.tsx` (E326). Muted autoplay + captions slot + fixed aspect ratio. |
| Thank-you | nothing to build | Checkout success routes to the shared `/p/[slug]/thanks` (E327) automatically. |

Then **register** the slug in `next-app/lib/sales/custom-pages.ts`:

```ts
const CUSTOM_SALES_PAGES: Record<string, SalesPageLoader> = {
  "<slug>": () => import("@/components/sales-pages/<slug>/page-content"),
}
```

Registration is the whole hook-up: the `/p/[slug]` route checks the registry
FIRST, so the slug now renders your TSX; unregistered slugs fall through to the
structured renderer. `generateStaticParams` picks the slug up automatically.

### Phase 4 — Verify & hand off

- **E332 backstop**: create/mark the slug's `sales_pages` row `render_mode=custom`
  and link the `product_id`. The admin then shows a "由 code 管理" badge and makes
  the content form read-only, so no one edits JSON that the code ignores.
- **Gates** (from `next-app/`): `pnpm typecheck` · `pnpm lint` · `pnpm test` ·
  `pnpm build` all green. New pure lib logic gets a unit test (registry
  resolution order lives in `lib/sales/custom-pages.test.ts`).
- **Playwright smoke** (`e2e/sales-pages.spec.ts`): one custom-render assertion
  (page renders + a CTA is present) and one structured-render assertion — proving
  both paths of the registry fork.
- **Speed**: keep it SSG/ISR-fast. The PRD red line is "1s slower ≈ 7% fewer
  conversions" — don't ship a client-heavy hero. Run Lighthouse if unsure.

## HTML-pattern → template convention (conversion table)

| Hand-off HTML pattern | Convert to |
|---|---|
| `style="color:#…"` / `background:#…` | Token utility (`text-primary`, `bg-card`, …). NEVER keep the inline colour. |
| `<img src=…>` | `next/image` with `width/height` or `fill`+`sizes`. |
| `@font-face` self-hosted font | The template's font pipeline (`app/layout.tsx` `next/font`). Don't self-load a font in the page. |
| `<video autoplay>` hero | `<VideoDemo mode="inline">` (muted + captions + poster; respects autoplay policy). |
| `<button onclick="checkout()">` | `<SalesCheckoutButton productSlug={product?.slug}>`. |
| Countdown JS widget | `<CountdownTimer deadline>`. |
| Hard-coded price text | `product.amount` / `product.currency` from props (server-owned). |
| Inline `<script>` | Delete it. CSP blocks inline scripts; move behaviour into a `"use client"` component. |
| A `.gradient { … }` one-off brand accent | A token if one fits; else a page-scoped CSS var in the page module. |

## Common traps

- **Self-loaded fonts** — a hand-off often `@font-face`s a font. Use the
  template's `next/font` setup instead or you get FOUT + a bundle bloat.
- **Autoplay policy** — browsers block audible autoplay. `<VideoDemo>` is muted;
  keep it that way.
- **Inline `<script>` / CSP** — the template sets security headers; inline
  scripts won't run. Port logic to a client component.
- **Dark mode** — a light-only hand-off often hard-codes dark text on light
  panels. Using tokens fixes it for free; hard-coded colours break in dark mode.
- **Re-querying price** — don't. Trust `product` from props; the route already
  loaded it server-side from the E327 SKU.
- **Skipping the E332 row** — without `render_mode=custom` an admin can publish a
  structured page on the same slug and be confused why edits don't show (the
  registry wins). Mark it custom.
- **Over-reaching to tier 3** — if a preset/variant (tier 1) or a section reorder
  (tier 2) would do, don't build a custom page.

## Reference implementation

`ai-launch-intensive` is a complete worked example of this pipeline:

- Page: `next-app/components/sales-pages/ai-launch-intensive/page-content.tsx`
- Registered in: `next-app/lib/sales/custom-pages.ts`
- Product + `render_mode=custom` row seeded in: `next-app/drizzle/seed.ts`

Walk it top-to-bottom to reproduce the pattern for a new slug.
