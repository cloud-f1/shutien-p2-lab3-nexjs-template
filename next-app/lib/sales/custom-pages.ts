import type { Metadata } from "next"
import type { ComponentType } from "react"

/**
 * Custom sales-page registry — E333.
 *
 * The three-tier sales-page architecture (see `docs/playbooks/sales-page-tiers.md`):
 *   1. **preset** — pick a style preset + hero variant (E326)
 *   2. **structured** — DB/config-driven section pipeline (E326/E332)
 *   3. **custom** — a fully hand-authored React page registered HERE (E333)
 *
 * A flagship offer sometimes needs a bespoke, off-grid layout that the
 * structured renderer can't express. Instead of a runtime HTML upload
 * (XSS/CSP/token-drift risk — explicitly out of scope), a custom page is a real
 * TSX component committed to the repo and registered in this map. The
 * `/p/[slug]` route checks this registry FIRST; a registered slug renders its
 * custom component, an unregistered slug falls through to the structured
 * renderer.
 *
 * `SalesPageProps` is the injection contract: the route resolves the linked
 * E327 product (price/currency/name are server-owned) and hands it to the
 * custom page so custom pages NEVER query prices or wire payment themselves —
 * their CTAs just forward `product.slug` to the shared `<SalesCheckoutButton>`
 * (which calls E327 `createOneTimeCheckout`).
 *
 * Entries are lazy: the value is an `import()` thunk, so a custom page's bundle
 * is only loaded when its slug is actually requested (registry lookups stay
 * cheap and db-free — hence unit-testable).
 */

/**
 * Server-owned product summary injected into a custom sales page. Sourced from
 * the E327 `products` row linked via the `sales_pages.product_id` FK — a custom
 * page trusts these values instead of re-deriving price/currency itself.
 */
export interface SalesPageProduct {
  slug: string
  name: string
  description: string | null
  /** Price in the smallest currency unit (TWD is 1:1; USD is cents). */
  amount: number
  /** ISO-4217 currency code. */
  currency: string
}

/**
 * Props every registered custom sales page receives from the `/p/[slug]` route.
 * `product` is `null` when the slug has no linked/active product yet — a custom
 * page must degrade gracefully (the shared checkout button disables itself).
 */
export interface SalesPageProps {
  slug: string
  product: SalesPageProduct | null
}

/** Shape of a custom-page module: a default component + optional page metadata. */
export interface SalesPageModule {
  default: ComponentType<SalesPageProps>
  /** Optional static metadata merged into the route's `generateMetadata`. */
  metadata?: Metadata
}

/** A lazy loader for a custom-page module (an `import()` thunk). */
export type SalesPageLoader = () => Promise<SalesPageModule>

/**
 * The registry. Add a slug here to route it to a hand-authored custom page.
 * Keep this the ONLY place slugs are wired — `isCustomSalesSlug` /
 * `getCustomSalesSlugs` derive from it so the route, `generateStaticParams`,
 * and the E332 admin stay in sync automatically.
 */
const CUSTOM_SALES_PAGES: Record<string, SalesPageLoader> = {
  "ai-launch-intensive": () =>
    import("@/components/sales-pages/ai-launch-intensive/page-content"),
}

/**
 * Resolve the lazy loader for a custom sales page, or `undefined` if the slug is
 * not registered (→ the route falls through to the structured renderer).
 */
export function getCustomSalesPageLoader(slug: string): SalesPageLoader | undefined {
  return Object.prototype.hasOwnProperty.call(CUSTOM_SALES_PAGES, slug)
    ? CUSTOM_SALES_PAGES[slug]
    : undefined
}

/** True when a slug is claimed by the custom registry. */
export function isCustomSalesSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(CUSTOM_SALES_PAGES, slug)
}

/** Every registered custom slug — feeds the `generateStaticParams` union. */
export function getCustomSalesSlugs(): string[] {
  return Object.keys(CUSTOM_SALES_PAGES)
}
