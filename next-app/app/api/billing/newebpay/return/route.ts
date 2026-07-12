/**
 * 藍新 NewebPay MPG notify Route Handler — E329.
 *
 * Both the MPG ReturnURL (幕前, browser POST) and NotifyURL (幕後, server-to-
 * server) point here; NewebPay POSTs a URL-encoded form { Status, MerchantID,
 * Version, TradeInfo, TradeSha }.
 *
 * Flow:
 * 1. Read the raw form body (must NOT be pre-parsed — TradeSha covers TradeInfo).
 * 2. verifyWebhook — recompute TradeSha (constant-time compare) + AES-decrypt
 *    TradeInfo; reject an invalid signature with 400.
 * 3. Decode MerchantOrderNo → orders.id UUID; look up the pending order.
 * 4. settleOrder() (E327 shared helper) — idempotent pending→paid transition,
 *    deduped on payment_events.provider_event_id.
 * 5. Respond HTTP 200 — NewebPay only requires a 200 ack (no magic body string,
 *    unlike ECPay's "1|OK"); a non-200 makes NewebPay retry the NotifyURL.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  getNewebPayProvider,
  merchantOrderNoToOrderId,
} from "@/lib/billing/providers/newebpay"

interface NewebPayNotifyPayload {
  status: string
  message: string
  merchantOrderNo: string
  tradeNo: string
  amount: number
  result: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const provider = getNewebPayProvider()

  let verifyResult: Awaited<ReturnType<typeof provider.verifyWebhook>>
  try {
    verifyResult = await provider.verifyWebhook(rawBody, {})
  } catch {
    // Config error (missing env vars) — let NewebPay retry.
    return new NextResponse("0|Error", { status: 500 })
  }

  if (!verifyResult.valid) {
    return new NextResponse("0|TradeSha invalid", { status: 400 })
  }

  const payload = verifyResult.payload as NewebPayNotifyPayload

  try {
    await settleFromNotify(payload, rawBody)
  } catch {
    // Unexpected error — non-200 so NewebPay retries the NotifyURL.
    return new NextResponse("0|Error", { status: 500 })
  }

  // NewebPay only needs a 200 ack.
  return new NextResponse("1|OK")
}

async function settleFromNotify(
  payload: NewebPayNotifyPayload,
  rawBody: string,
): Promise<void> {
  const orderId = merchantOrderNoToOrderId(payload.merchantOrderNo)
  if (!orderId) {
    // MerchantOrderNo wasn't one of our order-derived ids — nothing to settle.
    return
  }

  const { db } = await import("@/lib/db")
  const { ordersTable } = await import("@/lib/schema")
  const { eq } = await import("drizzle-orm")

  const [order] = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1)

  if (!order) return

  const { settleOrder } = await import("@/lib/billing/orders")
  await settleOrder({
    provider: "newebpay",
    // TradeNo is NewebPay's unique trade id; fall back to MerchantOrderNo.
    providerEventId: `newebpay:${payload.tradeNo || payload.merchantOrderNo}`,
    eventType: "newebpay.mpg.notify",
    orderId: order.id,
    providerOrderId: payload.tradeNo || payload.merchantOrderNo,
    payload: { rawBody, ...payload } as unknown as Record<string, unknown>,
    // Top-level Status="SUCCESS" ⇒ the charge succeeded.
    success: payload.status === "SUCCESS",
  })
}

// We read the raw body above — keep this handler dynamic.
export const dynamic = "force-dynamic"
