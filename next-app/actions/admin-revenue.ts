"use server"

/**
 * Admin revenue console Server Actions (E331). Two mutations + one read, all
 * admin-gated via the live-role re-read (defineAction `allow: isAdmin`, or an
 * explicit getLiveRole check for the read). CRM/gateway refunds still happen in
 * the payment provider's own back office; this system only records the terminal
 * status + revokes the linked entitlement (implicitly — see canMarkRefunded).
 */
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db"
import { ordersTable, passwordResetTokensTable, productsTable } from "@/lib/schema"
import { auth } from "@/lib/auth"
import { defineAction } from "@/lib/define-action"
import { isAdmin, getLiveRole } from "@/lib/permissions"
import { getUserByEmail, getUserById } from "@/lib/queries"
import { sendActivationEmail } from "@/lib/email"
import { generateResetToken, resetExpiry } from "@/lib/password-reset-utils"
import { canMarkRefunded, canResendActivation } from "@/lib/billing/admin-revenue"
import {
  getActiveSubscription,
  listOrdersForUser,
  type ActiveSubscription,
  type AdminOrderRow,
} from "@/lib/billing/queries"
import { getEntitledProducts, type EntitledProduct } from "@/lib/entitlements"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const ADMIN_PATH = "/dashboard/admin"

const orderIdSchema = z.object({ orderId: z.string().uuid("無效的訂單。") })

// ---------------------------------------------------------------------------
// 標記退款 — orders.status → refunded. The entitlement is revoked implicitly:
// the E328 ownership guard only counts `paid` orders (lib/entitlements.ts), so
// flipping off `paid` fails every access check on the next request — no second
// switch. Guarded to the `paid` state so it fires at most once (audit-safe).
// ---------------------------------------------------------------------------
const markRefundedAction = defineAction({
  allow: isAdmin,
  denyMessage: "只有管理員可以標記退款。",
  schema: orderIdSchema,
  revalidate: [ADMIN_PATH],
  handler: async ({ orderId }, ctx) => {
    const [order] = await db
      .select({ id: ordersTable.id, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1)

    if (!order) return { error: "找不到訂單。" }

    const check = canMarkRefunded(order.status)
    if ("error" in check) return check

    const result = await db
      .update(ordersTable)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "paid")))

    // postgres-js exposes rows-affected as `.count`; zero ⇒ a concurrent change
    // moved it off `paid` between our read and write — surface, don't silently ok.
    if ((result as { count?: number }).count === 0) {
      return { error: "訂單狀態已變更，請重新整理後再試。" }
    }

    return {
      data: {},
      audit: {
        actorId: ctx.actorId,
        action: "order.refunded",
        targetType: "order",
        targetId: orderId,
        metadata: { previousStatus: order.status },
      },
    }
  },
})

/** Thin wrapper preserving a simple `(orderId) => result` signature for the UI. */
export async function markRefunded(
  orderId: string,
): Promise<{ error?: string; success?: boolean }> {
  const res = await markRefundedAction({ orderId })
  return "ok" in res ? { success: true } : { error: res.error }
}

// ---------------------------------------------------------------------------
// 重寄啟用信 — reuses the E328 activation path. Idempotent-by-guard: refused once
// the account has a usable password (canResendActivation). Otherwise mints a
// fresh single-use reset/activation token (E290 infra) and re-sends the mail.
// ---------------------------------------------------------------------------
const resendActivationAction = defineAction({
  allow: isAdmin,
  denyMessage: "只有管理員可以重寄啟用信。",
  schema: orderIdSchema,
  revalidate: [ADMIN_PATH],
  handler: async ({ orderId }, ctx) => {
    const [order] = await db
      .select({
        customerEmail: ordersTable.customerEmail,
        userId: ordersTable.userId,
        productName: productsTable.name,
      })
      .from(ordersTable)
      .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
      .where(eq(ordersTable.id, orderId))
      .limit(1)

    if (!order) return { error: "找不到訂單。" }

    // Resolve the linked account (by user_id, else by purchase email).
    const user = order.userId
      ? await getUserById(order.userId)
      : await getUserByEmail(order.customerEmail.trim().toLowerCase())

    if (!user) return { error: "找不到對應的帳號（訂單尚未開通任何帳號）。" }

    const check = canResendActivation(user)
    if ("error" in check) return check

    const token = generateResetToken()
    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token,
      expiresAt: resetExpiry(new Date()),
    })

    // Mail is best-effort — the token is already minted, so a transient SMTP
    // failure must not roll back / block the audit trail (matches E328 posture).
    try {
      const activationUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`
      await sendActivationEmail(order.customerEmail, activationUrl, order.productName ?? "")
    } catch {
      // swallow — admin can retry; token remains valid for the buyer.
    }

    return {
      data: {},
      audit: {
        actorId: ctx.actorId,
        action: "order.activation_resent",
        targetType: "order",
        targetId: orderId,
        metadata: { userId: user.id },
      },
    }
  },
})

/** Thin wrapper preserving a simple `(orderId) => result` signature for the UI. */
export async function resendActivation(
  orderId: string,
): Promise<{ error?: string; success?: boolean }> {
  const res = await resendActivationAction({ orderId })
  return "ok" in res ? { success: true } : { error: res.error }
}

// ---------------------------------------------------------------------------
// 會員詳情 — on-demand read for the member-detail modal. Admin-gated with the
// same live-role re-read as the mutations (never trust the JWT snapshot). Read
// only, so it uses an explicit guard rather than defineAction (no revalidate).
// ---------------------------------------------------------------------------
export interface MemberDetail {
  user: {
    id: string
    name: string | null
    email: string
    role: string
    status: string
    emailVerified: boolean
    hasPassword: boolean
    createdAt: Date
  } | null
  orders: AdminOrderRow[]
  entitlements: EntitledProduct[]
  subscription: ActiveSubscription
}

export async function getMemberDetail(
  userId: string,
): Promise<{ ok: true; detail: MemberDetail } | { error: string }> {
  const session = await auth()
  const actorId = session?.user?.id
  if (!actorId) return { error: "請先登入。" }
  if (!isAdmin(await getLiveRole(actorId))) return { error: "權限不足。" }

  const parsed = z.string().uuid().safeParse(userId)
  if (!parsed.success) return { error: "無效的使用者。" }

  const [user, orders, entitlements, subscription] = await Promise.all([
    getUserById(parsed.data),
    listOrdersForUser(parsed.data),
    getEntitledProducts(parsed.data),
    getActiveSubscription(parsed.data),
  ])

  return {
    ok: true,
    detail: {
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            emailVerified: Boolean(user.emailVerified),
            hasPassword: Boolean(user.passwordHash),
            createdAt: user.createdAt,
          }
        : null,
      orders,
      entitlements,
      subscription,
    },
  }
}
