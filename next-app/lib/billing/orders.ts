/**
 * Order settlement state machine — E327 (SRP: the ONLY place an order changes
 * status). Webhook routes verify the gateway signature themselves, then call
 * `settleOrder()` with the already-verified result. This helper owns:
 *
 *   1. Idempotency — insert a `payment_events` row (onConflictDoNothing on the
 *      existing `provider_event_id` UNIQUE); an empty result means "already
 *      processed" and we stop. No new idempotency machinery.
 *   2. Transition — move the order `pending → paid` (or `pending → failed`)
 *      EXACTLY ONCE via a `WHERE status = 'pending'` guard, setting `paid_at`.
 *
 * DIP: depends only on the DB + schema, never on any concrete gateway module
 * under `lib/billing/providers/`. E329's NewebPay notify route reuses it as-is.
 */

import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { ordersTable, paymentEventsTable, productsTable } from "@/lib/schema"
import { provisionUserForOrder } from "@/lib/auth-provision"
import { sendActivationEmail, sendReceiptEmail } from "@/lib/email"
import { dispatchSystemEvent } from "@/lib/webhooks"

export interface SettleOrderInput {
  /** Gateway name — "stripe" | "ecpay" | … (for the payment_events row). */
  provider: string
  /**
   * Idempotency key — MUST be unique per gateway notification. Rides the
   * existing `payment_events.provider_event_id` UNIQUE constraint.
   */
  providerEventId: string
  /** Event type string for the audit/payment_events row. */
  eventType: string
  /** Our own `orders.id` to settle (carried through gateway metadata). */
  orderId: string
  /** The gateway's own trade/session id, recorded on the order. */
  providerOrderId?: string
  /** Raw parsed payload for the payment_events audit row. */
  payload?: Record<string, unknown>
  /** Whether the gateway reported a SUCCESSFUL payment. */
  success: boolean
}

export interface SettleOrderResult {
  /** True when THIS call transitioned a pending order to paid. */
  settled: boolean
  /** True when the event was already processed (idempotent skip). */
  duplicate: boolean
  /** The terminal effect of this call. */
  status: "paid" | "failed" | "skipped"
  /**
   * True only when THIS settlement auto-provisioned a new account for the buyer
   * (E328). False for an existing user, a duplicate/failed/skipped event, or when
   * delivery could not run. E330's `order.completed` payload consumes this.
   */
  isNewUser: boolean
}

/**
 * Settle (or fail) a pending order from an already-verified gateway webhook.
 * Idempotent: a duplicate delivery of the same `providerEventId` is a no-op, and
 * the `WHERE status = 'pending'` guard guarantees the paid transition + `paid_at`
 * happen at most once even if two distinct events race for the same order.
 */
export async function settleOrder(
  input: SettleOrderInput,
): Promise<SettleOrderResult> {
  // 1. Idempotency — record the event; empty result ⇒ already processed.
  const inserted = await db
    .insert(paymentEventsTable)
    .values({
      provider: input.provider,
      providerEventId: input.providerEventId,
      type: input.eventType,
      payload: (input.payload ?? {}) as Record<string, unknown>,
      processedAt: null,
    })
    .onConflictDoNothing({ target: paymentEventsTable.providerEventId })
    .returning({ id: paymentEventsTable.id })

  if (inserted.length === 0) {
    return { settled: false, duplicate: true, status: "skipped", isNewUser: false }
  }

  // 2. Transition the order (guarded to the pending state so it fires once).
  if (input.success) {
    const result = await db
      .update(ordersTable)
      .set({
        status: "paid",
        paidAt: new Date(),
        ...(input.providerOrderId ? { providerOrderId: input.providerOrderId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(ordersTable.id, input.orderId), eq(ordersTable.status, "pending")))

    await markEventProcessed(input.providerEventId)

    // postgres-js exposes rows-affected as `.count`.
    const settled = (result as { count?: number }).count
      ? (result as { count: number }).count > 0
      : false

    // 3. Delivery (E328) — only when THIS call flipped the order to paid. The
    //    whole step is best-effort: settlement NEVER fails on a provisioning or
    //    mail error (deliverEntitlement swallows everything and reports isNewUser).
    const isNewUser = settled ? await deliverEntitlement(input.orderId) : false

    // 4. CRM egress (E330) — emit `order.completed` to system-scoped webhooks,
    //    bound to THIS single pending→paid transition so exactly-once holds
    //    (a duplicate gateway webhook re-enters via the idempotency/guard above
    //    and never reaches here). Best-effort: NEVER blocks/fails settlement.
    if (settled) await emitOrderCompleted(input.orderId, isNewUser)

    return { settled, duplicate: false, status: "paid", isNewUser }
  }

  const failed = await db
    .update(ordersTable)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(ordersTable.id, input.orderId), eq(ordersTable.status, "pending")))
  void failed

  await markEventProcessed(input.providerEventId)
  return { settled: false, duplicate: false, status: "failed", isNewUser: false }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

/**
 * Post-settlement delivery (E328) — runs exactly once, right after a pending
 * order transitions to paid. Auto-provisions or links the buyer's account,
 * points `orders.user_id` at it, and sends the activation (new user) or receipt
 * (existing user) email. Returns whether a NEW account was created.
 *
 * Entirely best-effort: any failure (provisioning OR mail) is swallowed so the
 * settlement result is never affected — the paid transition already committed,
 * and a lost activation mail degrades to the standard forgot-password flow.
 */
async function deliverEntitlement(orderId: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({
        customerEmail: ordersTable.customerEmail,
        customerName: ordersTable.customerName,
        userId: ordersTable.userId,
        productName: productsTable.name,
      })
      .from(ordersTable)
      .innerJoin(productsTable, eq(ordersTable.productId, productsTable.id))
      .where(eq(ordersTable.id, orderId))
      .limit(1)

    if (!row) return false

    const prov = await provisionUserForOrder(row.customerEmail, row.customerName)

    // Link the order to the (existing or newly created) account if not already.
    if (row.userId !== prov.userId) {
      await db
        .update(ordersTable)
        .set({ userId: prov.userId, updatedAt: new Date() })
        .where(eq(ordersTable.id, orderId))
    }

    // Email is a further best-effort layer: a mail failure must NOT change the
    // reported isNewUser (the account + link already succeeded).
    try {
      if (prov.isNewUser && prov.activationToken) {
        const activationUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(
          prov.activationToken,
        )}`
        await sendActivationEmail(row.customerEmail, activationUrl, row.productName)
      } else {
        await sendReceiptEmail(row.customerEmail, row.productName, `${APP_URL}/dashboard/library`)
      }
    } catch {
      // mail is best-effort — never blocks settlement or flips isNewUser.
    }

    return prov.isNewUser
  } catch {
    // Provisioning/link failure must not fail settlement (already committed).
    return false
  }
}

/**
 * Emit `order.completed` to system-scoped webhooks (E330 — CRM egress). Runs
 * exactly once, right after a pending order flips to paid. The payload carries
 * NO secrets — just order/product/buyer identifiers per the PRD contract, plus
 * `isNewUser` from the E328 auto-provision result. `phone` is null until a phone
 * is captured at checkout (column not yet modeled — shape kept PRD-stable).
 *
 * Entirely best-effort: any failure is swallowed so settlement is never
 * affected. The paid transition (and entitlement delivery) already committed.
 */
async function emitOrderCompleted(orderId: string, isNewUser: boolean): Promise<void> {
  try {
    const [row] = await db
      .select({
        amount: ordersTable.amount,
        currency: ordersTable.currency,
        provider: ordersTable.provider,
        customerEmail: ordersTable.customerEmail,
        customerName: ordersTable.customerName,
        productName: productsTable.name,
      })
      .from(ordersTable)
      .innerJoin(productsTable, eq(ordersTable.productId, productsTable.id))
      .where(eq(ordersTable.id, orderId))
      .limit(1)

    if (!row) return

    await dispatchSystemEvent("order.completed", {
      orderId,
      amount: row.amount,
      currency: row.currency,
      productName: row.productName,
      gateway: row.provider,
      customer: {
        email: row.customerEmail,
        name: row.customerName ?? null,
        phone: null,
        isNewUser,
      },
    })
  } catch {
    // Best-effort — an egress failure must never affect settlement.
  }
}

async function markEventProcessed(providerEventId: string): Promise<void> {
  await db
    .update(paymentEventsTable)
    .set({ processedAt: new Date() })
    .where(eq(paymentEventsTable.providerEventId, providerEventId))
}
