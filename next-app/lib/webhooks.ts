import { and, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  webhookDeliveriesTable,
  webhooksTable,
  type Webhook,
  type WebhookDelivery,
} from "@/lib/schema"
import { backoffMs, signWebhook } from "@/lib/webhooks-utils"

export { generateWebhookSecret, signWebhook, verifyWebhook } from "@/lib/webhooks-utils"

/** A webhook without its signing secret — safe to send to the client. */
export type SafeWebhook = Omit<Webhook, "secret">

const SAFE_COLUMNS = {
  id: webhooksTable.id,
  userId: webhooksTable.userId,
  url: webhooksTable.url,
  events: webhooksTable.events,
  active: webhooksTable.active,
  createdAt: webhooksTable.createdAt,
}

/** List a user's webhook endpoints (newest first), never selecting the secret. */
export async function listWebhooks(userId: string): Promise<SafeWebhook[]> {
  return db
    .select(SAFE_COLUMNS)
    .from(webhooksTable)
    .where(eq(webhooksTable.userId, userId))
    .orderBy(desc(webhooksTable.createdAt))
}

/** Recent delivery attempts for one of a user's webhooks (owner-scoped). */
export async function listDeliveries(
  webhookId: string,
  userId: string,
  limit = 50,
): Promise<WebhookDelivery[]> {
  // Ensure the webhook belongs to the user before reading its deliveries.
  const [owned] = await db
    .select({ id: webhooksTable.id })
    .from(webhooksTable)
    .where(and(eq(webhooksTable.id, webhookId), eq(webhooksTable.userId, userId)))
    .limit(1)
  if (!owned) return []

  return db
    .select()
    .from(webhookDeliveriesTable)
    .where(eq(webhookDeliveriesTable.webhookId, webhookId))
    .orderBy(desc(webhookDeliveriesTable.createdAt))
    .limit(limit)
}

const MAX_ATTEMPTS = 3
const DELIVERY_TIMEOUT_MS = 5000

/**
 * POST a signed payload to one endpoint with bounded retry + backoff.
 * Records a single delivery row reflecting the final outcome. Never throws —
 * dispatch is best-effort and must not break the action that triggered it.
 */
export async function deliverToEndpoint(
  endpoint: Pick<Webhook, "id" | "url" | "secret">,
  event: string,
  payload: Record<string, unknown>,
): Promise<{ status: "success" | "failed"; responseCode: number | null; attempts: number }> {
  const body = JSON.stringify({ event, data: payload })
  let responseCode: number | null = null
  let attempts = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt
    try {
      const timestamp = Math.floor(new Date().getTime() / 1000)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-event": event,
          "x-webhook-signature": signWebhook(body, endpoint.secret, timestamp),
        },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer))

      responseCode = res.status
      if (res.ok) {
        await recordDelivery(endpoint.id, event, "success", responseCode, attempts, payload)
        return { status: "success", responseCode, attempts }
      }
    } catch {
      responseCode = null // network error / timeout
    }
    if (attempt < MAX_ATTEMPTS) await sleep(backoffMs(attempt))
  }

  await recordDelivery(endpoint.id, event, "failed", responseCode, attempts, payload)
  return { status: "failed", responseCode, attempts }
}

/**
 * Dispatch an event to every active endpoint of a user subscribed to it.
 * Fire-and-forget per endpoint; returns the per-endpoint outcomes.
 */
export async function dispatchEvent(
  userId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const endpoints = await db
    .select({
      id: webhooksTable.id,
      url: webhooksTable.url,
      secret: webhooksTable.secret,
      events: webhooksTable.events,
    })
    .from(webhooksTable)
    .where(and(eq(webhooksTable.userId, userId), eq(webhooksTable.active, true)))

  const targets = endpoints.filter((e) => e.events.includes(event) || e.events.includes("*"))
  await Promise.all(targets.map((e) => deliverToEndpoint(e, event, payload)))
  return targets.length
}

async function recordDelivery(
  webhookId: string,
  event: string,
  status: "success" | "failed" | "pending",
  responseCode: number | null,
  attempts: number,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(webhookDeliveriesTable).values({
      webhookId,
      event,
      status,
      responseCode,
      attempts,
      payload,
    })
  } catch {
    // swallow — delivery logging is best-effort
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
