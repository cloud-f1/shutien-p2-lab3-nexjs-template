/**
 * Browser-side funnel beacon helpers — E334. Imported by the sales-page client
 * components (funnel-tracker, checkout-button). Everything here is:
 *
 *   - Guarded (`typeof window`/`navigator`) so it is inert during SSR.
 *   - Silent on failure — a beacon must NEVER throw into page or checkout code.
 *   - First-party only — same-origin POST, no third-party request, no cookie.
 *
 * The captured UTM + slug are stashed in sessionStorage so the checkout button
 * (rendered separately from the tracker) can attribute cta_click / checkout_started
 * and carry the UTM into `createOneTimeCheckout`.
 */

import { normalizeUtm, type SalesPageEventName, type UtmParams } from "@/lib/analytics/funnel-utils"

export type { UtmParams }

const COLLECT_URL = "/api/analytics/collect"
const UTM_KEY = "funnel:utm"
const SLUG_KEY = "funnel:slug"

function safeSession(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Read UTM tags off the current URL, normalize them, and stash them (+ the slug)
 * in sessionStorage for later checkout attribution. Returns the normalized UTM.
 * Safe to call on every mount — later empty visits don't clobber a prior tagged
 * visit within the same session (first-touch attribution).
 */
export function captureUtm(slug: string): UtmParams {
  const store = safeSession()
  if (typeof window === "undefined") return normalizeUtm(null)

  const params = new URLSearchParams(window.location.search)
  const fromUrl = normalizeUtm({
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
  })

  if (store) {
    store.setItem(SLUG_KEY, slug)
    // First-touch: only persist if this visit carried tags OR none stored yet.
    const hasTags = fromUrl.source || fromUrl.medium || fromUrl.campaign
    if (hasTags || store.getItem(UTM_KEY) == null) {
      store.setItem(UTM_KEY, JSON.stringify(fromUrl))
    }
  }
  return getStoredUtm() ?? fromUrl
}

/** The UTM stashed for this session, or null if none captured. */
export function getStoredUtm(): UtmParams | null {
  const store = safeSession()
  const raw = store?.getItem(UTM_KEY)
  if (!raw) return null
  try {
    return normalizeUtm(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return null
  }
}

/** The slug of the sales page the visitor is currently on (for the checkout button). */
export function getStoredSlug(): string | null {
  return safeSession()?.getItem(SLUG_KEY) ?? null
}

/**
 * Fire a funnel beacon. Prefers `navigator.sendBeacon` (survives navigation);
 * falls back to `fetch(..., { keepalive: true })`. Never throws — a telemetry
 * failure is completely invisible to the caller.
 */
export function sendFunnelBeacon(input: {
  slug: string
  event: SalesPageEventName
  utm?: UtmParams | null
}): void {
  try {
    if (typeof window === "undefined") return
    const payload = JSON.stringify({
      slug: input.slug,
      event: input.event,
      utm: input.utm ?? getStoredUtm() ?? undefined,
    })

    const nav = typeof navigator !== "undefined" ? navigator : undefined
    if (nav?.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" })
      const ok = nav.sendBeacon(COLLECT_URL, blob)
      if (ok) return
    }
    // Fallback — keepalive lets the request outlive the page during navigation.
    void fetch(COLLECT_URL, {
      method: "POST",
      body: payload,
      headers: { "content-type": "application/json" },
      keepalive: true,
      credentials: "omit",
    }).catch(() => {})
  } catch {
    // Silent — telemetry must never affect the page or checkout.
  }
}
