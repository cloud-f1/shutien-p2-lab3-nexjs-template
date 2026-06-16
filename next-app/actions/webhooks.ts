"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { requireAuth } from "@/lib/permissions"
import { webhooksTable } from "@/lib/schema"
import { deliverToEndpoint, generateWebhookSecret } from "@/lib/webhooks"

const VALID_EVENTS = [
  "*",
  "user.created",
  "user.role_changed",
  "api_key.created",
  "api_key.revoked",
  "subscription.updated",
] as const

function sanitizeEvents(events: string[]): string[] {
  const set = new Set(events.filter((e) => (VALID_EVENTS as readonly string[]).includes(e)))
  return set.size ? [...set] : ["*"]
}

function isHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === "https:"
  } catch {
    return false
  }
}

/** Create a webhook endpoint for the current user. Returns the signing secret ONCE. */
export async function createWebhook(input: {
  url: string
  events: string[]
}): Promise<{ secret?: string; error?: string }> {
  const session = await requireAuth()
  const url = input.url?.trim()
  if (!url || !isHttpsUrl(url)) return { error: "請輸入有效的 HTTPS URL。" }
  if (url.length > 2048) return { error: "URL 過長（最多 2048 個字元）。" }

  const secret = generateWebhookSecret()
  const [row] = await db
    .insert(webhooksTable)
    .values({ userId: session.user.id, url, events: sanitizeEvents(input.events), secret })
    .returning({ id: webhooksTable.id })
  await logAudit({
    actorId: session.user.id,
    action: "webhook.created",
    targetType: "webhook",
    targetId: row?.id,
    metadata: { url },
  })

  revalidatePath("/dashboard/system")
  return { secret }
}

/** Toggle a webhook's active flag (owner-scoped). */
export async function setWebhookActive(id: string, active: boolean): Promise<{ error?: string }> {
  const session = await requireAuth()
  await db
    .update(webhooksTable)
    .set({ active })
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, session.user.id)))
  revalidatePath("/dashboard/system")
  return {}
}

/** Delete a webhook endpoint (owner-scoped). Cascades its delivery rows. */
export async function deleteWebhook(id: string): Promise<{ error?: string }> {
  const session = await requireAuth()
  await db
    .delete(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, session.user.id)))
  await logAudit({
    actorId: session.user.id,
    action: "webhook.deleted",
    targetType: "webhook",
    targetId: id,
  })
  revalidatePath("/dashboard/system")
  return {}
}

/** Send a signed `ping` to one of the user's endpoints and record the delivery. */
export async function sendTestEvent(id: string): Promise<{ status?: string; error?: string }> {
  const session = await requireAuth()
  const [endpoint] = await db
    .select({ id: webhooksTable.id, url: webhooksTable.url, secret: webhooksTable.secret })
    .from(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, session.user.id)))
    .limit(1)
  if (!endpoint) return { error: "找不到此 Webhook。" }

  const result = await deliverToEndpoint(endpoint, "ping", { message: "test", at: new Date().toISOString() })
  revalidatePath("/dashboard/system")
  return { status: result.status }
}
