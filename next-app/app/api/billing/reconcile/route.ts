/**
 * Billing reconcile recovery route — E274.
 *
 * Cron-callable endpoint that catches drift left by a MISSED webhook: it loads
 * the live (non-terminal) Stripe subscriptions from the `subscriptions` table,
 * fetches the gateway's ground-truth state, diffs them (pure — reconcile-utils),
 * and writes the repaired status / period-end / cancel-at back to the DB.
 *
 * Auth: gated behind the CRON_SECRET bearer token (same convention as the ECPay
 * renew job). Set CRON_SECRET and call with `Authorization: Bearer <secret>`.
 *
 * NOTE: this targets Stripe subscriptions (its provider has a single retrieve
 * API). ECPay 定期定額 renewal lives in app/api/billing/ecpay/renew/route.ts.
 */

import { NextRequest, NextResponse } from "next/server"

import { reconcileBatch, type StoredSubState } from "@/lib/billing/reconcile-utils"

// ---------------------------------------------------------------------------
// Auth helper — shared cron-secret bearer check
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // When no secret is configured, refuse (fail closed) — never run unauthenticated.
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  return header === `Bearer ${secret}`
}

// ---------------------------------------------------------------------------
// POST /api/billing/reconcile
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runReconcile()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function runReconcile(): Promise<{ checked: number; updated: number }> {
  const { db } = await import("@/lib/db")
  const { subscriptionsTable } = await import("@/lib/schema")
  const { and, eq, inArray } = await import("drizzle-orm")
  const { getStripeProvider } = await import("@/lib/billing/providers/stripe")

  // 1. Load live (non-terminal) Stripe subscriptions.
  const rows = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.provider, "stripe"),
        inArray(subscriptionsTable.status, [
          "active",
          "trialing",
          "past_due",
          "unpaid",
          "incomplete",
          "paused",
        ]),
      ),
    )

  if (rows.length === 0) return { checked: 0, updated: 0 }

  const stored: StoredSubState[] = rows.map((r) => ({
    providerSubId: r.providerSubId,
    status: r.status,
    currentPeriodEnd: r.currentPeriodEnd,
    cancelAt: r.cancelAt,
  }))

  // 2. Fetch the gateway ground-truth for those subs.
  const provider = getStripeProvider()
  const gateway = await provider.fetchGatewayStates(stored.map((s) => s.providerSubId))

  // 3. Pure diff (db-free).
  const summary = reconcileBatch(stored, gateway)

  // 4. Repair drift.
  for (const decision of summary.decisions) {
    if (!decision.needsUpdate || !decision.patch) continue
    await db
      .update(subscriptionsTable)
      .set({ ...decision.patch, updatedAt: new Date() })
      .where(eq(subscriptionsTable.providerSubId, decision.providerSubId))
  }

  return { checked: summary.checked, updated: summary.updated }
}

export const dynamic = "force-dynamic"
