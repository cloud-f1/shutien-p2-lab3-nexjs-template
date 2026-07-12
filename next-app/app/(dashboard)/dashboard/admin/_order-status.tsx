/**
 * Order-status display map (E331) — shared by the orders tab + member-detail
 * modal. Pure client-safe constant (no server imports), keyed by the
 * ORDER_STATUSES enum in lib/schema/billing.ts.
 */
import type { OrderStatus } from "@/lib/schema"

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: "success" | "warning" | "danger" | "muted" }
> = {
  pending: { label: "待付款", tone: "warning" },
  paid: { label: "已付款", tone: "success" },
  failed: { label: "失敗", tone: "danger" },
  refunded: { label: "已退款", tone: "muted" },
}
