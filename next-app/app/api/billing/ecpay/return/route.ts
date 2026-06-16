/**
 * ECPay ReturnURL Route Handler — E236 + E274.
 *
 * Receives the FIRST payment notification from ECPay after checkout.
 * ECPay POSTs a URL-encoded form body to this endpoint.
 *
 * Flow:
 * 1. Read raw form body
 * 2. Verify CheckMacValue (SHA256) — reject invalid with 400
 * 3. Idempotency: payment_events insert via onConflictDoNothing (UNIQUE on provider_event_id)
 * 4. On RtnCode=1: upsert subscription with the plans.id UUID FK + currentPeriodEnd
 * 5. Respond with "1|OK" (ECPay requires this exact response string)
 *
 * E274 hardening:
 * - Plan-identity FK: CustomField3 carries the plans.id UUID; written into
 *   subscriptions.planId (coerced via DB if a legacy session lacked it).
 * - currentPeriodEnd: derived from the period type (next charge date).
 * - Idempotency by SQLSTATE 23505 / onConflict, NOT string-matching the message.
 *
 * Note: ReturnURL receives the FIRST authorization. Subsequent period
 * notifications go to PeriodReturnURL (/api/billing/ecpay/period).
 */

import { NextRequest, NextResponse } from "next/server"
import { getEcpayProvider } from "@/lib/billing/providers/ecpay"
import { ecpayPeriodEndDate, type EcpayPeriodType } from "@/lib/billing/period-utils"

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
  } catch {
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
  const { coercePlanUuid } = await import("@/lib/billing/plans")

  const merchantTradeNo = params["MerchantTradeNo"] ?? ""
  const rtnCode = params["RtnCode"] ?? ""
  const tradeNo = params["TradeNo"] ?? ""

  // provider_event_id = "return:{MerchantTradeNo}" for ReturnURL events
  const providerEventId = `return:${merchantTradeNo}`

  // 3a. Idempotency: insert payment_events row first.
  // onConflictDoNothing on the UNIQUE provider_event_id — empty result = duplicate.
  const inserted = await db
    .insert(paymentEventsTable)
    .values({
      provider: "ecpay",
      providerEventId,
      type: "ecpay.return.payment",
      payload: { rawBody, params } as unknown as Record<string, unknown>,
      processedAt: null,
    })
    .onConflictDoNothing({ target: paymentEventsTable.providerEventId })
    .returning({ id: paymentEventsTable.id })

  if (inserted.length === 0) {
    // Already processed — idempotent skip.
    return
  }

  // 3b. Process only successful payments (RtnCode=1)
  if (rtnCode === "1") {
    // Extract userId and planId from CustomField1/2/3 (set during checkout).
    const userId = params["CustomField1"] ?? ""
    const planIdEncoding = params["CustomField2"] ?? "" // "interval:amount:description"
    const planUuidField = params["CustomField3"] ?? "" // plans.id UUID (E274)

    // E274 plan-identity FK fix: resolve the plans.id UUID. Prefer CustomField3;
    // fall back to coercing whatever CustomField2 carried via the DB.
    const planId = await coercePlanUuid(planUuidField || planIdEncoding)

    if (userId && planId) {
      // Parse plan info from the encoding: "interval:amount:description"
      const parts = planIdEncoding.split(":")
      const interval = parts[0] ?? "month"

      // Determine ExecTimes + ECPay PeriodType from interval.
      const periodType: EcpayPeriodType =
        interval === "year" ? "Y" : interval === "day" ? "D" : "M"
      const execTimes = periodType === "Y" ? 99 : 999

      const periodEnd = ecpayPeriodEndDate({ period_type: periodType }, new Date())

      const providerMeta = {
        merchant_trade_no: merchantTradeNo,
        ecpay_trade_no: tradeNo,
        exec_times: execTimes,
        total_success_times: 1,
        exec_status: "1", // RUNNING
        period_type: periodType,
        first_auth_amount: parseInt(params["TradeAmt"] ?? "0", 10),
        current_period_end: periodEnd ? Math.floor(periodEnd.getTime() / 1000) : null,
      }

      // E274 idempotent upsert on the provider_sub_id UNIQUE constraint.
      await db
        .insert(subscriptionsTable)
        .values({
          userId,
          planId,
          provider: "ecpay",
          providerSubId: merchantTradeNo,
          status: "active",
          currentPeriodEnd: periodEnd,
          cancelAt: null,
          providerMeta,
        })
        .onConflictDoUpdate({
          target: subscriptionsTable.providerSubId,
          set: {
            planId,
            status: "active",
            currentPeriodEnd: periodEnd,
            providerMeta,
            updatedAt: new Date(),
          },
        })
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
