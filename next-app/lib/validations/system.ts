import { z } from "zod"

/**
 * E369 — Zod contracts for the API-key / webhook / team mutations.
 *
 * E348 and E352 removed `validateItemTitle()` because a hand-rolled checker had
 * silently drifted from the schema it was supposed to mirror. That fix was
 * applied to items only; every other mutation entry point kept its own
 * hand-written validation, and the same drift was already visible:
 *
 *   - `actions/team.ts` had `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`, which
 *     accepts `a@b.c` while the `z.string().email()` used everywhere else in
 *     this codebase does not. Two answers to "what is a valid email", depending
 *     on which door you came in.
 *   - `actions/api-keys.ts` enforced a 100-char name limit that existed nowhere
 *     else, so no form or REST caller could know about it.
 *   - `actions/webhooks.ts` hand-rolled its HTTPS check and — worse — its
 *     `sanitizeEvents()` did not REJECT an invalid event list, it silently
 *     REWROTE it to `["*"]`. A single typo'd event name turned a request for
 *     one event into a subscription to ALL of them, with no error, on an
 *     endpoint whose whole job is shipping data to a third-party URL.
 *
 * Everything below is the single source for its field.
 */

/** Webhook target: HTTPS only, length-capped. */
const webhookUrlSchema = z
  .string({ invalid_type_error: "請輸入有效的 HTTPS URL。" })
  .trim()
  .min(1, "請輸入有效的 HTTPS URL。")
  .max(2048, "URL 過長（最多 2048 個字元）。")
  .refine((raw) => {
    try {
      return new URL(raw).protocol === "https:"
    } catch {
      return false
    }
  }, "請輸入有效的 HTTPS URL。")

/** User-scoped webhook events. */
export const WEBHOOK_EVENTS = [
  "*",
  "user.created",
  "user.role_changed",
  "api_key.created",
  "api_key.revoked",
  "subscription.updated",
] as const

/** System-scoped webhook events (admin, E330 egress). */
export const SYSTEM_WEBHOOK_EVENTS = ["*", "order.completed"] as const

/**
 * Event list. Note `"*"` is a MEMBER of the enum, so "subscribe to everything"
 * is something a caller states explicitly — it is never something they get
 * handed after a typo, which is what the old `sanitizeEvents()` did.
 * Duplicates are collapsed; an empty or invalid list is an error, not a default.
 */
const eventsSchema = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values), { invalid_type_error: "事件清單格式有誤。" })
    .min(1, "請至少選擇一個事件。")
    .transform((list) => [...new Set(list)])

export const createWebhookSchema = z.object({
  url: webhookUrlSchema,
  events: eventsSchema(WEBHOOK_EVENTS),
})

export const createSystemWebhookSchema = z.object({
  url: webhookUrlSchema,
  events: eventsSchema(SYSTEM_WEBHOOK_EVENTS).optional().default(["order.completed"]),
})

export const createApiKeySchema = z.object({
  name: z
    .string({ invalid_type_error: "請輸入金鑰名稱。" })
    .trim()
    .min(1, "請輸入金鑰名稱。")
    .max(100, "金鑰名稱過長（最多 100 個字元）。"),
})

export const VALID_ROLES = ["admin", "editor", "viewer"] as const

export const inviteMemberSchema = z.object({
  // The project-wide definition of a valid email — NOT a local regex.
  email: z
    .string({ invalid_type_error: "請輸入有效的電子郵件。" })
    .trim()
    .toLowerCase()
    .email("請輸入有效的電子郵件。"),
  role: z.enum(VALID_ROLES, { errorMap: () => ({ message: "無效的角色。" }) }),
})
