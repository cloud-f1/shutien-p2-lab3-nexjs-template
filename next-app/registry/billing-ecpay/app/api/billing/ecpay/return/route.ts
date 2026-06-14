/**
 * ECPay ReturnURL Route Handler — E236
 *
 * Receives the FIRST payment notification from ECPay after checkout.
 * ECPay POSTs a URL-encoded form body to this endpoint.
 *
 * Flow:
 * 1. Read raw form body
 * 2. Verify CheckMacValue (SHA256) — reject invalid with 400
 * 3. Idempotency: insert payment_events row (UNIQUE on provider_event_id)
 * 4. On RtnCode=1: create/update subscription in DB with provider_meta
 * 5. Respond with "1|OK" (ECPay requires this exact response string)
 *
 * Note: ReturnURL receives the FIRST authorization. Subsequent period
 * notifications go to PeriodReturnURL (/api/billing/ecpay/period).
 *
 * ECPay retry behavior: if this endpoint doesn't respond "1|OK" within 10 seconds,
 * ECPay will retry. All processing should be fast or deferred to a queue.
 */

import { NextRequest, NextResponse } from "next/server"
import { getEcpayProvider } from "@/lib/billing/providers/ecpay"

// ---------------------------------------------------------------------------
// POST /api/billing/ecpay/return
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Read raw body — must NOT be parsed first for CheckMacValue verification
  const rawBody = await request.text()

  // 2. Verify CheckMacValue via the ECPay provider
  const provider = getEcpayProvider()

  let verifyResult: Awaited<ReturnType<typeof provider.verifyWebhook>>
  try {
    verifyResult = await provider.verifyWebhook(rawBody, {})
  } catch {
    // Config error (missing env vars)
    return new NextResponse("0|Error", { status: 500 })
  }

  if (!verifyResult.valid) {
    return new NextResponse("0|CheckMacValue invalid", { status: 400 })
  }

  const params = verifyResult.payload as Record<string, string>

  // 3. Idempotency + processing
  try {
    await processReturnNotification(params, rawBody)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"

    // Duplicate event — idempotency constraint; silently succeed
    if (message.includes("duplicate") || message.includes("unique")) {
      return new NextResponse("1|OK")
    }

    // Unexpected error — return non-OK so ECPay retries
    return new NextResponse("0|Error", { status: 500 })
  }

  // 4. ECPay requires "1|OK" response for successful processing
  return new NextResponse("1|OK")
}

// ---------------------------------------------------------------------------
// Process the ReturnURL notification
// ---------------------------------------------------------------------------

async function processReturnNotification(
  params: Record<string, string>,
  rawBody: string,
): Promise<void> {
  const { db } = await import("@/lib/db")
  const { paymentEventsTable, subscriptionsTable } = await import("@/lib/schema")
  const { eq } = await import("drizzle-orm")

  const merchantTradeNo = params["MerchantTradeNo"] ?? ""
  const rtnCode = params["RtnCode"] ?? ""
  const tradeNo = params["TradeNo"] ?? ""

  // provider_event_id = "return:{MerchantTradeNo}" for ReturnURL events
  const providerEventId = `return:${merchantTradeNo}`

  // 3a. Idempotency: insert payment_events row first
  // UNIQUE constraint on providerEventId will throw on duplicate
  await db.insert(paymentEventsTable).values({
    provider: "ecpay",
    providerEventId,
    type: "ecpay.return.payment",
    payload: { rawBody, params } as unknown as Record<string, unknown>,
    processedAt: null,
  })

  // 3b. Process only successful payments (RtnCode=1)
  if (rtnCode === "1") {
    // Extract userId and planId from CustomField1/2 (set during checkout)
    const userId = params["CustomField1"] ?? ""
    const planId = params["CustomField2"] ?? ""

    if (userId && planId) {
      // Parse plan info from planId: "interval:amount:description"
      const parts = planId.split(":")
      const interval = parts[0] ?? "month"

      // Determine ExecTimes from period type
      const periodType = interval === "year" ? "Y" : interval === "day" ? "D" : "M"
      const execTimes = periodType === "Y" ? 99 : 999

      // Upsert subscription row
      const existingSubs = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.providerSubId, merchantTradeNo))
        .limit(1)

      const providerMeta = {
        merchant_trade_no: merchantTradeNo,
        ecpay_trade_no: tradeNo,
        exec_times: execTimes,
        total_success_times: 1,
        exec_status: "1", // RUNNING
        period_type: periodType,
        first_auth_amount: parseInt(params["TradeAmt"] ?? "0", 10),
      }

      if (existingSubs.length === 0) {
        await db.insert(subscriptionsTable).values({
          userId,
          planId,
          provider: "ecpay",
          providerSubId: merchantTradeNo,
          status: "active",
          currentPeriodEnd: null,
          cancelAt: null,
          providerMeta,
        })
      } else {
        await db
          .update(subscriptionsTable)
          .set({
            status: "active",
            providerMeta,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionsTable.providerSubId, merchantTradeNo))
      }
    }
  } else {
    // Failed first payment — mark subscription as incomplete if it exists
    await db
      .update(subscriptionsTable)
      .set({ status: "incomplete", updatedAt: new Date() })
      .where(eq(subscriptionsTable.providerSubId, merchantTradeNo))
  }

  // 3c. Mark event as processed
  await db
    .update(paymentEventsTable)
    .set({ processedAt: new Date() })
    .where(eq(paymentEventsTable.providerEventId, providerEventId))
}

// ---------------------------------------------------------------------------
// Prevent Next.js from buffering — we read raw body above
// ---------------------------------------------------------------------------
export const dynamic = "force-dynamic"
