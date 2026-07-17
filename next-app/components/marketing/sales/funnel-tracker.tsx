"use client"

import { useEffect } from "react"

import { captureUtm, sendFunnelBeacon } from "@/lib/analytics/beacon"

/**
 * Invisible funnel tracker (E334) mounted on every `/p/[slug]` page. On mount it
 * captures the landing UTM (stashing it for checkout attribution) and fires a
 * single `page_view` beacon. Renders nothing and does NO synchronous work in the
 * render path — the beacon goes out after hydration, so the sales page's TTFB is
 * completely unaffected (the DB write happens server-side, off the render path).
 *
 * The one-per-mount guard (a ref would reset on remount; a module set keyed by
 * slug dedupes an accidental double-mount in React StrictMode dev) keeps a single
 * view per page load.
 */
const viewedThisLoad = new Set<string>()

export function FunnelTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const utm = captureUtm(slug)
    if (viewedThisLoad.has(slug)) return
    viewedThisLoad.add(slug)
    sendFunnelBeacon({ slug, event: "page_view", utm })
  }, [slug])

  return null
}
