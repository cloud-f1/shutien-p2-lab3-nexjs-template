# E328 — 購買後交付開通（entitlement guard + 我的內容庫）

> Phase 77 · feature/backend+ui · Cycle 35（數位產品/課程銷售頁 PRD，2026-07-12）
> Status: ⬜ pending
> Depends: E327

## Problem

E327 records paid orders but nothing *delivers* the digital product: no server-side access guard,
no place for a buyer to reach what they bought. PRD scope decision (user, 2026-07-12): full
「結帳 + 訂單 + 交付開通」.

## Solution

1. **Entitlement guard** — `lib/entitlements.ts`: `hasEntitlement(userId, entitlementKey)` — derived
   from `orders.status='paid'` joined to `products.entitlement_key` (no new table; an order IS the
   entitlement). Live DB read per request, same posture as RBAC role re-read.
2. **會員自動開通（user decision 2026-07-12：自動建帳 + 啟用信）** — inside `settleOrder()` after the
   paid transition commits: if no user matches `customer_email` → auto-provision the account with
   **no usable password** and send an **activation email**（「設定密碼」連結，重用 E290
   `password_reset_tokens` 基礎設施）; link `orders.user_id` either way. **Never email a plaintext /
   random password**（PRD 原案的安全修正）. Expose `isNewUser` on the settlement result — E330's
   `order.completed` payload consumes it. Lost activation mail degrades gracefully: the standard
   password-reset flow covers re-sending.
3. **Gated content route** — `app/(dashboard)/dashboard/library/page.tsx`（我的內容庫）: lists the
   user's paid products via `<DataTable>`; each links to
   `app/(dashboard)/dashboard/library/[slug]/page.tsx` — the delivery surface (course modules /
   download links from a per-product content map) guarded server-side by `hasEntitlement` →
   `notFound()`/redirect-to-sales-page on miss.
4. **Actions** — any mutation via `defineAction` with the entitlement/auth hook; no client-trusted
   checks.（原 claim-guest-order flow 由上面的自動開通取代，不再需要。）
5. **感謝頁 handoff** — E327's thanks page links「前往我的內容庫」when the buyer is logged in; new
   buyers see「啟用信已寄至 {email}，設定密碼即可進入內容庫」.
6. **Emails** — reuse the existing mailer (mailpit in dev): activation email (new user) or receipt +
   library link (existing user) on `settleOrder()` success (best-effort, non-blocking — settlement
   never fails on mail errors).

## Key Files
- `next-app/lib/entitlements.ts` (+ tests)
- `next-app/app/(dashboard)/dashboard/library/page.tsx` + `[slug]/page.tsx`
- `next-app/lib/billing/orders.ts` (auto-provision + email hooks in settleOrder, extend)
- `next-app/lib/auth-provision.ts`（auto-provision helper — 重用 E290 token 產生器）

## Acceptance Criteria
- [ ] Direct URL access to gated content without a paid order → blocked server-side (int test)
- [ ] Paid user sees the product in 內容庫 and can open the delivery page
- [ ] New-email purchase → user auto-provisioned (no usable password) + activation email in mailpit;
      set-password link works; buyer lands in 內容庫 with entitlement live
- [ ] Existing-email purchase → order linked to that user, receipt email sent, **no** new account
- [ ] No plaintext/random password ever generated or mailed (grep + test assertion)
- [ ] Settle succeeds even if mail fails; `isNewUser` correctly reported on the settlement result
- [ ] `<DataTable>` used for the library list; modals convention respected for any CRUD
- [ ] Vitest + `test:int` for the guard; typecheck/lint/build green

## Cross-Epic
- E327 — source of `orders`/`entitlement_key`; extends `settleOrder()`
- E255-era RBAC posture — same live-DB re-read discipline (security-audit skill §8: never confuse
  authorization flag with ownership — entitlement is *ownership*, checked as such)

## Out of Scope
- Video hosting/DRM, drip-release scheduling, progress tracking (future epics)
- Refund-triggered revocation UI (status enum already supports it; wire later)
