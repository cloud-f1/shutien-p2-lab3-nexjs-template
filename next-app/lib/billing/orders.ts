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
import { ordersTable, paymentEventsTable } from "@/lib/schema"

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
    return { settled: false, duplicate: true, status: "skipped" }
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
    return { settled, duplicate: false, status: "paid" }
  }

  const failed = await db
    .update(ordersTable)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(ordersTable.id, input.orderId), eq(ordersTable.status, "pending")))
  void failed

  await markEventProcessed(input.providerEventId)
  return { settled: false, duplicate: false, status: "failed" }
}

async function markEventProcessed(providerEventId: string): Promise<void> {
  await db
    .update(paymentEventsTable)
    .set({ processedAt: new Date() })
    .where(eq(paymentEventsTable.providerEventId, providerEventId))
}
