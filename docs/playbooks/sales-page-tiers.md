# Playbook — Three-Tier Sales-Page Architecture

> How to publish a `/p/[slug]` sales page in this template, and how to pick the
> cheapest tier that expresses the offer. Ties together **E326** (preset +
> structured sections), **E332** (DB-backed admin CRUD + ISR), and **E333**
> (custom code pages).

A high-converting sales page is sometimes a form field away and sometimes a
bespoke, designer-crafted one-off. Forcing everything through one mechanism
either handcuffs the flagship pages or over-engineers the routine ones. So the
template offers **three tiers**, sharing one route (`/p/[slug]`), one product /
checkout binding (E327), and one thank-you page.

```
                       /p/[slug]  (app/p/[slug]/page.tsx)
                              │
         ┌────────────────────┴─────────────────────┐
         │  1. custom registry?  (lib/sales/custom-pages.ts)   ← checked FIRST
         │        yes → render hand-authored TSX (tier 3)
         │        no  ↓
         │  2. structured resolver  (lib/sales/resolver.ts)
         │        DB row (E332)  →  else config (E326)         ← tiers 1 & 2
         └──────────────────────────────────────────┘
```

## The three tiers

### Tier 1 — Preset

Pick a **style preset** (`bold` / `premium` / `clean`) and a **hero variant**
(`video-top` / `video-left` / `minimal`). You get the full 8-section AIDA flow
(hero → pain points → solution → modules → testimonials → pricing → risk reversal
→ FAQ) styled consistently with the brand tokens.

- **Owned by**: an admin, in the E332 form (no deploy).
- **Source**: `lib/sales/styles.ts` (preset → Tailwind token bundles),
  `lib/sales/types.ts` (variant + section-order enums).

### Tier 2 — Structured

Same section components, but you **reorder or omit** sections and author all the
copy as a `SalesPageContent` payload (validated by `salesPageContentSchema` on
every write). Stored as a `sales_pages` row (JSONB) — publish/edit/unpublish take
effect immediately via ISR, no rebuild.

- **Owned by**: an admin, in the E332 form (no deploy).
- **Source**: `lib/sales/content.ts` (schema + config fallback),
  `lib/sales/resolver.ts` (DB-first, config fallback), `app/p/[slug]/page.tsx`
  (section renderer). Admin: `app/(dashboard)/dashboard/admin/sales-pages/`.

### Tier 3 — Custom

A fully **hand-authored TSX page** for a flagship offer whose layout the section
pipeline can't express. Registered in `lib/sales/custom-pages.ts`; the route
checks the registry FIRST. The route injects `SalesPageProps` — the slug plus the
resolved E327 **product** — so the custom page's CTA drives real checkout and
displays server-owned prices **without** querying anything itself.

- **Owned by**: an engineer, in code → PR → deploy.
- **Source**: `lib/sales/custom-pages.ts` (registry + `SalesPageProps`),
  `components/sales-pages/<slug>/page-content.tsx` (the page),
  `components/marketing/sales/checkout-button.tsx` (shared CTA).
- **Build it with**: the `sales-page-builder` skill (HTML → custom TSX pipeline).
- **Reference**: `ai-launch-intensive`.

> **Out of scope, on purpose**: runtime HTML upload/render (XSS/CSP/token-drift).
> A/B split within a slug (the registry structure leaves room for it later). A
> visual editor (the path stays agent/code).

## Decision table — which tier?

| Question | → Tier |
|---|---|
| Standard offer; brand-consistent look is fine? | **1 — preset** |
| Need to reorder/drop sections or edit copy, but the section shapes fit? | **2 — structured** |
| Non-technical teammate must edit it live without a deploy? | **1 or 2** (never 3) |
| Layout is genuinely off-grid (bespoke hero, custom section rhythm) that the 8 sections can't express? | **3 — custom** |
| Starting from a hand-off HTML one-pager (Claude-Design / Figma / outsourced)? | **3 — custom**, via the `sales-page-builder` skill |
| Flagship / big-campaign page where design is a differentiator? | **3 — custom** |

**Rule of thumb**: choose the cheapest tier that expresses the offer. Escalate to
tier 3 only when tiers 1–2 can't — a custom page is more surface to maintain and
can't be edited by ops.

## Cost / capability comparison

| | Tier 1 preset | Tier 2 structured | Tier 3 custom |
|---|---|---|---|
| Who ships it | admin | admin | engineer |
| Deploy needed | no | no | **yes** (PR) |
| Live-editable by ops | yes | yes | no (code) |
| Layout freedom | low (fixed sections) | medium (reorder/omit) | **total** |
| Maintenance cost | lowest | low | highest |
| Checkout wiring | automatic | automatic | automatic (injected `product`) |
| Countdown / video | automatic | automatic | compose E326 primitives |
| Thank-you page | shared `/p/[slug]/thanks` | shared | shared |

## Interlocks that keep the tiers honest

- **Registry wins**: `app/p/[slug]/page.tsx` checks `getCustomSalesPageLoader(slug)`
  before the structured resolver — a custom slug can't be shadowed by a DB row.
- **`render_mode=custom` backstop** (E332): mark the custom slug's `sales_pages`
  row `custom`. The admin then shows a "由 code 管理" badge and makes the content
  form **read-only**, so ops can't edit JSON the code ignores. The structured
  resolver also skips `custom` rows (returns `undefined`), so the registry is the
  single owner.
- **One product / checkout binding** (E327): all tiers link a `products` row via
  `sales_pages.product_id`; prices and payment are server-owned everywhere.
- **`generateStaticParams`** unions config + DB-published + custom slugs, so every
  tier is pre-rendered; `dynamicParams` keeps the rest on-demand (ISR).

## Related

- Skill: `sales-page-builder` — the HTML → custom TSX conversion pipeline (tier 3).
- Epics: E326 (preset/structured), E327 (unified checkout), E332 (admin CRUD/ISR),
  E333 (custom registry + this playbook).
- `docs/playbooks/mockup-to-production.md` — the general mockup → product path.
