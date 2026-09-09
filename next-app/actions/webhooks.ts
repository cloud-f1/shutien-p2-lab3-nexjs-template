"use server"

import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { requireAdmin, requireAuth } from "@/lib/permissions"
import { rateLimitGuard } from "@/lib/rate-limit"
import { webhooksTable } from "@/lib/schema"
import { deliverToEndpoint, generateWebhookSecret } from "@/lib/webhooks"
import { toCsv } from "@/lib/export-utils"
import { webhookToExportRow } from "@/lib/export-row-mappers"
import {
  createSystemWebhookSchema,
  createWebhookSchema,
} from "@/lib/validations/system"

const MINUTE_MS = 60_000

// E369 — VALID_EVENTS / sanitizeEvents() / isHttpsUrl() all lived here as
// hand-rolled checks. They now come from lib/validations/system.ts. The
// important behaviour change: an invalid event list is REJECTED rather than
// silently rewritten to ["*"] — a typo used to turn "subscribe to one event"
// into "subscribe to everything", with no error, on an endpoint that ships data
// to a third-party URL.

/** Create a webhook endpoint for the current user. Returns the signing secret ONCE. */
export async function createWebhook(input: {
  url: string
  events: string[]
}): Promise<{ secret?: string; error?: string }> {
  const session = await requireAuth()

  const limited = rateLimitGuard(`webhook:create:${session.user.id}`, 10, MINUTE_MS)
  if (limited) return limited

  const parsed = createWebhookSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]!.message }
  const { url, events } = parsed.data

  const secret = generateWebhookSecret()
  const [row] = await db
    .insert(webhooksTable)
    .values({ userId: session.user.id, url, events, secret })
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

  const limited = rateLimitGuard(`webhook:toggle:${session.user.id}`, 10, MINUTE_MS)
  if (limited) return limited

  const result = await db
    .update(webhooksTable)
    .set({ active })
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, session.user.id)))

  // E368 — see actions/api-keys.ts revokeApiKey for the full rationale.
  if (result.count === 0) {
    return { error: "找不到 webhook，或您沒有權限修改。" }
  }

  revalidatePath("/dashboard/system")
  return {}
}

/** Delete a webhook endpoint (owner-scoped). Cascades its delivery rows. */
export async function deleteWebhook(id: string): Promise<{ error?: string }> {
  const session = await requireAuth()

  const limited = rateLimitGuard(`webhook:delete:${session.user.id}`, 10, MINUTE_MS)
  if (limited) return limited

  const result = await db
    .delete(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, session.user.id)))

  // E368 — audit write must not run for a delete that matched nothing.
  if (result.count === 0) {
    return { error: "找不到 webhook，或您沒有權限刪除。" }
  }

  await logAudit({
    actorId: session.user.id,
    action: "webhook.deleted",
    targetType: "webhook",
    targetId: id,
  })
  revalidatePath("/dashboard/system")
  return {}
}

/**
 * Export all webhook endpoints for the current user as CSV (admin only).
 * The signing secret is NEVER included in the export.
 */
export async function exportWebhooks(): Promise<
  | { success: true; data: string; filename: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    await requireAdmin()
  } catch {
    return { success: false, error: "權限不足。" }
  }

  const rows = await db
    .select({
      id: webhooksTable.id,
      userId: webhooksTable.userId,
      url: webhooksTable.url,
      events: webhooksTable.events,
      active: webhooksTable.active,
      createdAt: webhooksTable.createdAt,
    })
    .from(webhooksTable)
    .orderBy(desc(webhooksTable.createdAt))

  const exportRows = rows.map(webhookToExportRow)
  const headers = ["id", "userId", "url", "events", "active", "createdAt"]
  const data = toCsv(exportRows, headers)
  const filename = `webhooks-${new Date().toISOString().slice(0, 10)}.csv`

  return { success: true, data, filename, contentType: "text/csv" }
}

// ---------------------------------------------------------------------------
// System-scoped webhooks (E330 — CRM egress). Admin-only: every action gates on
// requireAdmin() (which re-reads the live role from the DB), and each mutation is
// additionally scoped to `scope = 'system'` so it can never touch a user webhook.
// ---------------------------------------------------------------------------

/** Site-wide events a system endpoint may subscribe to (E330). */

async function ensureAdmin(): Promise<{ userId: string } | { error: string }> {
  try {
    const session = await requireAdmin()
    return { userId: session.user.id }
  } catch {
    return { error: "權限不足。" }
  }
}

/**
 * Create a system-scoped webhook endpoint (admin only). Returns the signing
 * secret ONCE. These endpoints receive site-wide events (e.g. `order.completed`)
 * for CRM egress — the payload contains buyer PII, so the URL is a secret.
 */
export async function createSystemWebhook(input: {
  url: string
  events?: string[]
}): Promise<{ secret?: string; error?: string }> {
  const guard = await ensureAdmin()
  if ("error" in guard) return guard

  const limited = rateLimitGuard(`webhook:sys:create:${guard.userId}`, 10, MINUTE_MS)
  if (limited) return limited

  // E369 — same schema treatment as the user-scoped path. The `["order.completed"]`
  // default now lives in the schema, applied only when `events` is ABSENT — an
  // explicitly-supplied invalid list is an error, not a silent substitution.
  const parsed = createSystemWebhookSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]!.message }
  const { url, events } = parsed.data

  const secret = generateWebhookSecret()
  const [row] = await db
    .insert(webhooksTable)
    .values({
      userId: guard.userId,
      url,
      events,
      secret,
      scope: "system",
    })
    .returning({ id: webhooksTable.id })
  await logAudit({
    actorId: guard.userId,
    action: "system_webhook.created",
    targetType: "webhook",
    targetId: row?.id,
    metadata: { url, scope: "system" },
  })

  revalidatePath("/dashboard/system")
  return { secret }
}

/** Toggle a system webhook's active flag (admin only, system-scope-guarded). */
export async function setSystemWebhookActive(
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  const guard = await ensureAdmin()
  if ("error" in guard) return guard

  const limited = rateLimitGuard(`webhook:sys:toggle:${guard.userId}`, 10, MINUTE_MS)
  if (limited) return limited

  const result = await db
    .update(webhooksTable)
    .set({ active })
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.scope, "system")))

  // E368 — scope-scoped WHERE matching zero rows ⇒ no state changed, no event.
  if (result.count === 0) {
    return { error: "找不到系統 webhook。" }
  }

  await logAudit({
    actorId: guard.userId,
    action: active ? "system_webhook.enabled" : "system_webhook.disabled",
    targetType: "webhook",
    targetId: id,
  })
  revalidatePath("/dashboard/system")
  return {}
}

/** Delete a system webhook endpoint (admin only, system-scope-guarded). */
export async function deleteSystemWebhook(id: string): Promise<{ error?: string }> {
  const guard = await ensureAdmin()
  if ("error" in guard) return guard

  const limited = rateLimitGuard(`webhook:sys:delete:${guard.userId}`, 10, MINUTE_MS)
  if (limited) return limited

  const result = await db
    .delete(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.scope, "system")))

  // E368 — see setSystemWebhookActive.
  if (result.count === 0) {
    return { error: "找不到系統 webhook。" }
  }

  await logAudit({
    actorId: guard.userId,
    action: "system_webhook.deleted",
    targetType: "webhook",
    targetId: id,
  })
  revalidatePath("/dashboard/system")
  return {}
}

/** Send a signed `ping` to a system endpoint and record the delivery (admin only). */
export async function sendSystemTestEvent(id: string): Promise<{ status?: string; error?: string }> {
  const guard = await ensureAdmin()
  if ("error" in guard) return guard

  const limited = rateLimitGuard(`webhook:sys:test:${guard.userId}`, 3, MINUTE_MS)
  if (limited) return limited

  const [endpoint] = await db
    .select({ id: webhooksTable.id, url: webhooksTable.url, secret: webhooksTable.secret })
    .from(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.scope, "system")))
    .limit(1)
  if (!endpoint) return { error: "找不到此系統 Webhook。" }

  const result = await deliverToEndpoint(endpoint, "ping", {
    message: "test",
    at: new Date().toISOString(),
  })
  revalidatePath("/dashboard/system")
  return { status: result.status }
}

/** Send a signed `ping` to one of the user's endpoints and record the delivery. */
export async function sendTestEvent(id: string): Promise<{ status?: string; error?: string }> {
  const session = await requireAuth()

  // Tighter bucket (3/min): test deliveries make outbound HTTP calls, so this
  // doubles as SSRF-amplification / webhook-spam protection.
  const limited = rateLimitGuard(`webhook:test:${session.user.id}`, 3, MINUTE_MS)
  if (limited) return limited

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
