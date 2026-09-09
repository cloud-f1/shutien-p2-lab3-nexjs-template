import type { SalesPageRenderMode, SalesPageStatus } from "@/lib/schema/sales"

/**
 * The status rule, shared by BOTH render paths (E367).
 *
 * Extracted from `canServeSalesPageRow` because the E333 custom path needs the
 * SAME rule but must not inherit the structured renderer's mode guard. Before
 * E367 the status rule lived only inside `canServeSalesPageRow`, which returns
 * false for `custom` — so the custom route never consulted a status gate at all,
 * and `/p/<slug>` served draft/unpublished custom pages to anonymous visitors.
 * Each side assumed the other owned the decision.
 */
export function isSalesPageStatusVisible(
  status: SalesPageStatus,
  hasValidPreview: boolean,
): boolean {
  if (status === "published") return true
  return hasValidPreview
}

/**
 * Visibility decision for a `sales_pages` row in the STRUCTURED renderer (E332).
 * Kept db-free so it is directly unit-testable; `lib/sales/resolver.ts` composes
 * it with the DB read + preview-token check.
 *
 * Rules:
 * - `custom` render mode → never served by the STRUCTURED renderer (the E333
 *   registry owns that slug). This is a render-path guard, NOT a status gate —
 *   the custom path applies `isSalesPageStatusVisible` itself (E367).
 * - otherwise → the shared status rule: `published` always; `draft` only with a
 *   valid preview token.
 */
export function canServeSalesPageRow(
  meta: { status: SalesPageStatus; renderMode: SalesPageRenderMode },
  hasValidPreview: boolean,
): boolean {
  if (meta.renderMode === "custom") return false
  return isSalesPageStatusVisible(meta.status, hasValidPreview)
}
