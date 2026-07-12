/**
 * Entitlements — E328. An entitlement is OWNERSHIP, not a permission flag: a user
 * is entitled to a product's content iff they have a PAID `orders` row for a
 * product carrying that `entitlement_key`. There is no separate entitlements
 * table — an order IS the entitlement (security-audit skill §8).
 *
 * Every check is a LIVE DB read per request (same posture as the RBAC live-role
 * re-read in lib/permissions.ts) — never trust a client-supplied flag, and never
 * cache ownership into a token/session where a refund can't revoke it.
 */

import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { ordersTable, productsTable } from "@/lib/schema"

/**
 * True iff `userId` owns a PAID order for a product whose `entitlement_key`
 * matches `entitlementKey`. Live DB read; server-side only.
 */
export async function hasEntitlement(
  userId: string,
  entitlementKey: string,
): Promise<boolean> {
  if (!userId || !entitlementKey) return false

  const rows = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .innerJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(
      and(
        eq(ordersTable.userId, userId),
        eq(ordersTable.status, "paid"),
        eq(productsTable.entitlementKey, entitlementKey),
      ),
    )
    .limit(1)

  return rows.length > 0
}

/** A deliverable product a user owns — shaped for the 內容庫 list. */
export interface EntitledProduct {
  id: string
  slug: string
  name: string
  description: string | null
  entitlementKey: string
  purchasedAt: Date | null
}

/**
 * List every deliverable product `userId` owns (PAID order + a non-null
 * `entitlement_key`), most-recent purchase first. De-duplicated by product so a
 * repeat purchase of the same product shows once. Powers the 我的內容庫 page.
 */
export async function getEntitledProducts(userId: string): Promise<EntitledProduct[]> {
  if (!userId) return []

  const rows = await db
    .select({
      id: productsTable.id,
      slug: productsTable.slug,
      name: productsTable.name,
      description: productsTable.description,
      entitlementKey: productsTable.entitlementKey,
      purchasedAt: ordersTable.paidAt,
    })
    .from(ordersTable)
    .innerJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(and(eq(ordersTable.userId, userId), eq(ordersTable.status, "paid")))

  // De-dupe by product id, keeping the most recent paid_at.
  const byProduct = new Map<string, EntitledProduct>()
  for (const r of rows) {
    if (!r.entitlementKey) continue // not deliverable without an entitlement key
    const existing = byProduct.get(r.id)
    const candidate: EntitledProduct = {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      entitlementKey: r.entitlementKey,
      purchasedAt: r.purchasedAt,
    }
    if (!existing) {
      byProduct.set(r.id, candidate)
    } else if (
      candidate.purchasedAt &&
      (!existing.purchasedAt || candidate.purchasedAt > existing.purchasedAt)
    ) {
      byProduct.set(r.id, candidate)
    }
  }

  return [...byProduct.values()].sort((a, b) => {
    const at = a.purchasedAt?.getTime() ?? 0
    const bt = b.purchasedAt?.getTime() ?? 0
    return bt - at
  })
}
