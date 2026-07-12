/**
 * Pure admin-revenue guards (E331) — NO db import, so they are unit-testable in
 * isolation (mirrors lib/billing/billing-utils.ts). The admin console Server
 * Actions (actions/admin-revenue.ts) call these to decide whether a "標記退款"
 * (mark-refund) or "重寄啟用信" (resend-activation) is permitted, before touching
 * the DB. Keeping the decision here means the rules are tested once, not
 * re-derived — and the action handler stays a thin DB adapter.
 *
 * Design boundary (security-audit skill §8): these are OWNERSHIP/STATE guards,
 * not the role gate. Admin authorization is enforced separately by defineAction's
 * `allow: isAdmin` (live role re-read). These functions never look at the actor.
 */
import type { OrderStatus } from "@/lib/schema"

export type GuardResult = { ok: true } | { error: string }

/**
 * A one-time order may be marked refunded only from the `paid` terminal — a
 * `pending`/`failed` order was never charged, and a second `refunded` is a no-op
 * that would spam the audit log. The entitlement is revoked implicitly: the E328
 * guard (lib/entitlements.ts) only counts `paid` orders, so flipping the status
 * off `paid` immediately fails every access check — no second toggle needed.
 */
export function canMarkRefunded(status: OrderStatus): GuardResult {
  if (status === "refunded") return { error: "此訂單已標記退款。" }
  if (status !== "paid") return { error: "只有已付款的訂單可以標記退款。" }
  return { ok: true }
}

/**
 * Resending the activation (set-password) email is idempotent-by-guard: it is
 * meaningful ONLY while the account still has no usable password (the E328
 * auto-provision path leaves `password_hash` NULL until the buyer sets one). Once
 * a password exists the buyer can just log in / use forgot-password, so a resend
 * is refused rather than minting yet another token (avoids abuse / token spam).
 */
export function canResendActivation(user: { passwordHash: string | null }): GuardResult {
  if (user.passwordHash) {
    return { error: "此帳號已設定密碼，無需重寄啟用信（可改用忘記密碼流程）。" }
  }
  return { ok: true }
}
