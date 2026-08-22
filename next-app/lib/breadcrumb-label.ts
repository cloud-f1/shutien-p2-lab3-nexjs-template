"use client"

/**
 * E339 — dynamic breadcrumb label overrides for record-detail routes.
 *
 * `<AppBreadcrumb>` (components/app-breadcrumb.tsx) derives every segment's
 * label from `NAV_LABELS` (lib/nav.ts), which has no entry for a dynamic id
 * segment (e.g. `/dashboard/items/<uuid>`) — it would otherwise fall back to
 * a capitalized raw id. A record-detail page knows its own title (fetched in
 * `page.tsx`), but `<AppBreadcrumb>` lives in the shared dashboard layout
 * (`app/(dashboard)/layout.tsx`), a sibling of `{children}` — there is no
 * prop path from a leaf page down to it.
 *
 * This is a tiny client-side pub/sub keyed by full pathname, read via
 * `useSyncExternalStore` in `<AppBreadcrumb>` and written by
 * `<DynamicBreadcrumbLabel>` (components/dynamic-breadcrumb-label.tsx),
 * which a detail page's client child (e.g. `_detail/header.tsx`) renders
 * with the record's title. It sets the override on mount and clears it on
 * unmount, so navigating away reverts to the default NAV_LABELS lookup.
 *
 * Module-singleton state is safe here: this is the browser tab's live nav
 * state, not app data — nothing to persist, nothing shared across requests.
 */

type Listener = () => void

const overrides = new Map<string, string>()
const listeners = new Set<Listener>()

function emitChange() {
  for (const listener of listeners) listener()
}

/** Set the breadcrumb label to show for an exact pathname. */
export function setBreadcrumbLabel(pathname: string, label: string): void {
  overrides.set(pathname, label)
  emitChange()
}

/** Remove the override for a pathname (call on unmount). */
export function clearBreadcrumbLabel(pathname: string): void {
  overrides.delete(pathname)
  emitChange()
}

/** Current override for a pathname, or `undefined` if none is set. */
export function getBreadcrumbLabel(pathname: string): string | undefined {
  return overrides.get(pathname)
}

/** `useSyncExternalStore` subscribe function. */
export function subscribeBreadcrumbLabel(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
