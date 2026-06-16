/**
 * Single-knob branding source of truth.
 *
 * Rebrand the whole template by setting ONE build-time env var:
 *   NEXT_PUBLIC_APP_NAME="Your Product"
 *
 * NEXT_PUBLIC_* vars are baked into the bundle at `next build` time — change it
 * then rebuild (it has no effect at runtime). When unset, the default keeps the
 * template's original "AI App Template" branding so nothing changes.
 *
 * This module is intentionally db-free and client-safe (zero server-only imports),
 * so it can be imported from both Server and Client Components.
 */

/** Display name for the app — drives logos, nav, footer, sidebar, and document title. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "AI App Template"

/** Default meta description (zh-Hant); routes may override with their own metadata. */
export const APP_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() ||
  "內建認證、3 階 RBAC、模組化金流與深色主題的 Next.js SaaS 起手式。"
