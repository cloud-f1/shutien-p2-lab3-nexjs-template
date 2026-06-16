/**
 * Plan-identity DB resolver (E274) — thin wrapper over the pure helpers in
 * plan-resolver-utils.ts. Imports `@/lib/db`, so it is NOT imported by unit tests
 * (which run without a DATABASE_URL); the route handlers + checkout action use it.
 *
 * Resolves a `plans.id` UUID from a `providerPriceId`, creating the row from
 * `config/pricing.json` when missing so a real checkout can always insert.
 */

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { plansTable } from "@/lib/schema"
import { isUniqueViolation } from "@/lib/billing/idempotency-utils"
import {
  coercePlanUuid as coercePlanUuidPure,
  planRowFromPriceId,
  type PlanIdRow,
} from "@/lib/billing/plan-resolver-utils"

/** Load all plan id ↔ providerPriceId pairs (small table, one row per tier). */
export async function loadPlanIdRows(): Promise<PlanIdRow[]> {
  return db
    .select({ id: plansTable.id, providerPriceId: plansTable.providerPriceId })
    .from(plansTable)
}

/**
 * Resolve the `plans.id` UUID for a given providerPriceId. When the row is
 * missing, create it from `config/pricing.json`. Throws when the price id is not
 * defined in config (an invalid checkout).
 */
export async function resolveOrCreatePlanId(providerPriceId: string): Promise<string> {
  // 1. Already present?
  const existing = await db
    .select({ id: plansTable.id })
    .from(plansTable)
    .where(eq(plansTable.providerPriceId, providerPriceId))
    .limit(1)
  if (existing[0]) return existing[0].id

  // 2. Build the row from config (single source of truth).
  const row = planRowFromPriceId(providerPriceId)
  if (!row) {
    throw new Error(
      `[billing] providerPriceId "${providerPriceId}" is not defined in config/pricing.json.`,
    )
  }

  // 3. Insert — tolerate a concurrent insert race (re-select on conflict).
  try {
    const [created] = await db.insert(plansTable).values(row).returning({ id: plansTable.id })
    if (created) return created.id
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
  }

  const [after] = await db
    .select({ id: plansTable.id })
    .from(plansTable)
    .where(eq(plansTable.providerPriceId, providerPriceId))
    .limit(1)
  if (after) return after.id
  throw new Error(`[billing] failed to resolve plan id for "${providerPriceId}".`)
}

/**
 * Coerce a webhook's `metadata.planId` into a real plans UUID, resolving a legacy
 * providerPriceId via the DB when needed. Returns null when unresolvable.
 */
export async function coercePlanUuid(
  metadataPlanId: string | null | undefined,
): Promise<string | null> {
  const rows = await loadPlanIdRows()
  return coercePlanUuidPure(metadataPlanId, rows)
}
