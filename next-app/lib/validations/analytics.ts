import { z } from "zod"

import { SALES_PAGE_EVENTS } from "@/lib/analytics/funnel-utils"

/**
 * Funnel beacon payload — E334. Validates the body POSTed to
 * `/api/analytics/collect` (via navigator.sendBeacon). Kept db-free so the
 * contract is unit-testable in isolation (and in vitest's coverage include).
 *
 * The session hash is NOT accepted from the client — it is derived server-side
 * from request headers so a caller can neither forge nor read another visitor's
 * session. Only the slug, event, and first-party UTM tags come from the client.
 */
export const collectEventSchema = z.object({
  slug: z.string().trim().min(1, "缺少 slug").max(255, "slug 過長"),
  event: z.enum(SALES_PAGE_EVENTS, { message: "不支援的事件" }),
  utm: z
    .object({
      source: z.string().trim().max(200).nullish(),
      medium: z.string().trim().max(200).nullish(),
      campaign: z.string().trim().max(200).nullish(),
    })
    .partial()
    .optional(),
})

export type CollectEventInput = z.infer<typeof collectEventSchema>
