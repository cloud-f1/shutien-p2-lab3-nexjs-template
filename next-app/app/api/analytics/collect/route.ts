/**
 * Funnel beacon sink — E334. Receives `navigator.sendBeacon` POSTs from
 * `/p/[slug]` pages and records one `sales_page_events` row. Deliberately
 * minimal + fire-and-forget:
 *
 *   - ALWAYS returns 204 (even on a bad/again-malformed body) so a beacon never
 *     surfaces an error to the visitor and never blocks page/checkout code.
 *   - Stores NO PII: the raw IP / User-Agent are used ONLY to derive a
 *     day-scoped one-way session hash (lib/analytics/session-hash.ts) and are
 *     never persisted. No cookie is read or set (same-origin, credential-less).
 *   - The client cannot forge the session hash — it is computed here from
 *     request headers, not accepted from the body.
 *
 * nodejs runtime: needs the postgres-js client + node:crypto (session hash).
 */

import { after, type NextRequest } from "next/server"

import { recordSalesPageEvent } from "@/lib/analytics/funnel"
import { dayScopedSessionHash } from "@/lib/analytics/session-hash"
import { collectEventSchema } from "@/lib/validations/analytics"

export const runtime = "nodejs"

const NO_CONTENT = new Response(null, { status: 204 })

/** First IP in x-forwarded-for (best-effort; used only to derive the session hash). */
function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]?.trim() || null
  return req.headers.get("x-real-ip")
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NO_CONTENT
  }

  const parsed = collectEventSchema.safeParse(body)
  if (!parsed.success) return NO_CONTENT

  // Derive the anonymous, day-scoped session hash from headers (never stored raw).
  const sessionHash = dayScopedSessionHash({
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  })

  // Record after the response so the beacon returns instantly (best-effort write).
  after(async () => {
    await recordSalesPageEvent({
      slug: parsed.data.slug,
      event: parsed.data.event,
      sessionHash,
      utm: parsed.data.utm ?? null,
    })
  })

  return NO_CONTENT
}
