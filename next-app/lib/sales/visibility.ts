import type { SalesPageRenderMode, SalesPageStatus } from "@/lib/schema/sales"

/**
 * Pure visibility decision for a `sales_pages` row in the STRUCTURED renderer
 * (E332). Kept db-free so it is directly unit-testable; `lib/sales/resolver.ts`
 * composes it with the DB read + preview-token check.
 *
 * Rules:
 * - `custom` render mode → never served by the structured renderer (the E333
 *   custom-page registry owns that slug; returning false makes the route 404
 *   until the registry claims it).
 * - `published` → always served.
 * - `draft` → served ONLY when a valid preview token was presented.
 */
export function canServeSalesPageRow(
  meta: { status: SalesPageStatus; renderMode: SalesPageRenderMode },
  hasValidPreview: boolean,
): boolean {
  if (meta.renderMode === "custom") return false
  if (meta.status === "published") return true
  return hasValidPreview
}
