/**
 * ECPay PeriodReturnURL Route Handler — E236
 *
 * Receives RECURRING payment notifications from ECPay (2nd cycle onwards).
 * ECPay POSTs a URL-encoded form body to this endpoint once per successful billing cycle.
 *
 * Flow:
 * 1. Read raw form body
 * 2. Verify CheckMacValue (SHA256) — reject invalid with "0|Error"
 * 3. Idempotency: insert payment_events row (UNIQUE on provider_event_id)
 * 4. Update subscription.provider_meta with latest TotalSuccessTimes
 * 5. Check if remaining periods < threshold → flag for renewal
 * 6. Respond with "1|OK"
 *
 * PeriodReturnURL params include:
 * - MerchantTradeNo: original trade number
 * - TotalSuccessTimes: number of successful authorizations so far
 * - ExecTimes: original configured exec times
 * - RtnCode: 1=success
 * - Amount: this period's charge amount
 * - Gwsr: authorization transaction number (use as event ID)
 *
 * Renewal logic:
 * - remaining = ExecTimes - TotalSuccessTimes
 * - When remaining < RENEWAL_THRESHOLD or ExecStatus=2, build a NEW 定期定額 order
 *   (ECPay has no auto-renew after ExecTimes exhaustion — merchant must rebuild)
 */

import { NextRequest, NextResponse } from "next/server"
import { getEcpayProvider, EXEC_STATUS, DEFAULT_RENEWAL_THRESHOLD } from "@/lib/billing/providers/ecpay"
import { ecpayNextChargeDate, type EcpayPeriodType } from "@/lib/billing/period-utils"

// ---------------------------------------------------------------------------
// POST /api/billing/ecpay/period
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Read raw body
  const rawBody = await request.text()

  // 2. Verify CheckMacValue
  const provider = getEcpayProvider()

  let verifyResult: Awaited<ReturnType<typeof provider.verifyWebhook>>
  try {
    verifyResult = await provider.verifyWebhook(rawBody, {})
  } catch {
    return new NextResponse("0|Error", { status: 500 })
  }

  if (!verifyResult.valid) {
    return new NextResponse("0|CheckMacValue invalid", { status: 400 })
  }

  const params = verifyResult.payload as Record<string, string>

  // 3. Idempotency + processing
  try {
    await processPeriodNotification(params, rawBody)
  } catch {
    return new NextResponse("0|Error", { status: 500 })
  }

  return new NextResponse("1|OK")
}

// ---------------------------------------------------------------------------
// Process the PeriodReturnURL notification
// ---------------------------------------------------------------------------

async function processPeriodNotification(
  params: Record<string, string>,
  rawBody: string,
): Promise<void> {
  const { db } = await import("@/lib/db")
  const { paymentEventsTable, subscriptionsTable } = await import("@/lib/schema")
  const { eq } = await import("drizzle-orm")

  const merchantTradeNo = params["MerchantTradeNo"] ?? ""
  const rtnCode = params["RtnCode"] ?? ""
  const gwsr = params["Gwsr"] ?? ""
  const totalSuccessTimes = parseInt(params["TotalSuccessTimes"] ?? "0", 10)
  const execTimes = parseInt(params["ExecTimes"] ?? "0", 10)
  const amount = parseInt(params["Amount"] ?? "0", 10)

  // provider_event_id = "period:{MerchantTradeNo}:{Gwsr}" for PeriodReturnURL events
  // Gwsr (授權交易單號) is unique per authorization
  const providerEventId = `period:${merchantTradeNo}:${gwsr}`

  // 3a. Idempotency — onConflictDoNothing on the UNIQUE provider_event_id.
  // Empty returning() => this Gwsr was already processed → skip.
  const inserted = await db
    .insert(paymentEventsTable)
    .values({
      provider: "ecpay",
      providerEventId,
      type: "ecpay.period.payment",
      payload: { rawBody, params } as unknown as Record<string, unknown>,
      processedAt: null,
    })
    .onConflictDoNothing({ target: paymentEventsTable.providerEventId })
    .returning({ id: paymentEventsTable.id })

  if (inserted.length === 0) {
    return
  }

  // 3b. Update subscription provider_meta with latest state
  const existing = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.providerSubId, merchantTradeNo))
    .limit(1)

  if (existing.length > 0) {
    const sub = existing[0]!
    const currentMeta = (sub.providerMeta ?? {}) as Record<string, unknown>

    const remaining = execTimes - totalSuccessTimes
    const renewalThreshold =
      Number(currentMeta["renewal_threshold"] ?? DEFAULT_RENEWAL_THRESHOLD)

    const newStatus = rtnCode === "1" ? "active" : "past_due"
    const needsRenewal = remaining < renewalThreshold

    // E274: advance currentPeriodEnd by one cycle from the successful charge.
    const periodType = (typeof currentMeta["period_type"] === "string"
      ? currentMeta["period_type"]
      : "M") as EcpayPeriodType
    const nextChargeAt =
      rtnCode === "1" ? ecpayNextChargeDate(new Date(), periodType, 1) : sub.currentPeriodEnd

    const updatedMeta: Record<string, unknown> = {
      ...currentMeta,
      total_success_times: totalSuccessTimes,
      exec_times: execTimes,
      exec_status: needsRenewal ? EXEC_STATUS.COMPLETED : EXEC_STATUS.RUNNING,
      last_period_amount: amount,
      last_period_gwsr: gwsr,
      last_period_at: new Date().toISOString(),
      needs_renewal: needsRenewal,
      current_period_end: nextChargeAt ? Math.floor(nextChargeAt.getTime() / 1000) : null,
    }

    await db
      .update(subscriptionsTable)
      .set({
        status: newStatus,
        currentPeriodEnd: nextChargeAt,
        providerMeta: updatedMeta,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.providerSubId, merchantTradeNo))
  }

  // 3c. Mark event as processed
  await db
    .update(paymentEventsTable)
    .set({ processedAt: new Date() })
    .where(eq(paymentEventsTable.providerEventId, providerEventId))
}

// ---------------------------------------------------------------------------
// Prevent Next.js from buffering
// ---------------------------------------------------------------------------
export const dynamic = "force-dynamic"
