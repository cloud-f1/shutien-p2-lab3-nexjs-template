// Pure billing display helpers — NO db import (unit-testable).
import type { SubscriptionStatus } from "@/lib/billing/provider"

/** Format an amount in the smallest currency unit (cents) for display. */
export function formatAmount(amount: number, currency = "usd"): string {
  const major = amount / 100
  const symbol = currency.toLowerCase() === "twd" ? "NT$" : "$"
  return `${symbol}${major.toLocaleString(undefined, { minimumFractionDigits: major % 1 ? 2 : 0 })}`
}

const STATUS_LABELS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "muted" }> = {
  active: { label: "使用中", tone: "success" },
  trialing: { label: "試用中", tone: "success" },
  past_due: { label: "逾期", tone: "warning" },
  canceled: { label: "已取消", tone: "muted" },
  unpaid: { label: "未付款", tone: "danger" },
  incomplete: { label: "未完成", tone: "warning" },
  incomplete_expired: { label: "已過期", tone: "muted" },
  paused: { label: "已暫停", tone: "muted" },
}

export function subscriptionStatusLabel(status: SubscriptionStatus | string): {
  label: string
  tone: "success" | "warning" | "danger" | "muted"
} {
  return STATUS_LABELS[status] ?? { label: status, tone: "muted" }
}
