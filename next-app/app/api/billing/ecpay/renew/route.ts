/**
 * ECPay 定期定額 renewal scheduler — E274.
 *
 * Cron-callable endpoint. ECPay 定期定額 has NO auto-renew once `ExecTimes` is
 * exhausted: the merchant must rebuild a NEW periodic order before the runway
 * runs out. This job:
 *
 * 1. Loads all active ECPay subscriptions.
 * 2. Queries each via QueryCreditCardPeriodInfo (provider.queryAndCheckRenewal).
 * 3. Flags those whose remaining periods < threshold OR ExecStatus=2 (completed)
 *    in provider_meta.needs_renewal so the next checkout/UI prompts a rebuild,
 *    and advances the tracked totals.
 *
 * Auth: CRON_SECRET bearer token (fail closed when unset).
 *
 * Building the replacement order requires the user's payment consent (a fresh
 * AioCheckOut redirect), so this job marks state + emits a notification rather
 * than silently re-charging — surfaced in the BillingPanel.
 */

import { NextRequest, NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  return header === `Bearer ${secret}`
}

// ---------------------------------------------------------------------------
// POST /api/billing/ecpay/renew
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runRenewalSweep()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function runRenewalSweep(): Promise<{
  checked: number
  flagged: number
  details: Array<{ merchantTradeNo: string; remaining: number; needsRenewal: boolean }>
}> {
  const { db } = await import("@/lib/db")
  const { subscriptionsTable } = await import("@/lib/schema")
  const { and, eq } = await import("drizzle-orm")
  const { getEcpayProvider } = await import("@/lib/billing/providers/ecpay")

  // 1. Active ECPay subscriptions.
  const rows = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.provider, "ecpay"),
        eq(subscriptionsTable.status, "active"),
      ),
    )

  if (rows.length === 0) {
    return { checked: 0, flagged: 0, details: [] }
  }

  const provider = getEcpayProvider()
  const details: Array<{ merchantTradeNo: string; remaining: number; needsRenewal: boolean }> = []
  let flagged = 0

  for (const row of rows) {
    const merchantTradeNo = row.providerSubId
    const info = await provider.queryAndCheckRenewal(merchantTradeNo)
    if (!info) continue

    details.push({
      merchantTradeNo,
      remaining: info.remaining,
      needsRenewal: info.needsRenewal,
    })

    // 2. Persist the latest totals + renewal flag.
    const currentMeta = (row.providerMeta ?? {}) as Record<string, unknown>
    const updatedMeta: Record<string, unknown> = {
      ...currentMeta,
      exec_status: info.execStatus,
      exec_times: info.execTimes,
      total_success_times: info.totalSuccessTimes,
      needs_renewal: info.needsRenewal,
      renewal_checked_at: new Date().toISOString(),
    }

    await db
      .update(subscriptionsTable)
      .set({ providerMeta: updatedMeta, updatedAt: new Date() })
      .where(eq(subscriptionsTable.providerSubId, merchantTradeNo))

    if (info.needsRenewal) flagged++
  }

  return { checked: rows.length, flagged, details }
}

export const dynamic = "force-dynamic"
