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
   entitlement). Live DB read per request, same posture as RBAC role re-read. Guest orders attach on
   first login/signup with the matching verified email (claim step).
2. **Gated content route** — `app/(dashboard)/dashboard/library/page.tsx`（我的內容庫）: lists the
   user's paid products via `<DataTable>`; each links to
   `app/(dashboard)/dashboard/library/[slug]/page.tsx` — the delivery surface (course modules /
   download links from a per-product content map) guarded server-side by `hasEntitlement` →
   `notFound()`/redirect-to-sales-page on miss.
3. **Actions** — any mutation (e.g. claim-guest-order) via `defineAction` with the entitlement/auth
   hook; no client-trusted checks.
4. **感謝頁 handoff** — E327's thanks page links「前往我的內容庫」when the buyer is (or becomes)
   logged in; guest flow explains the claim-by-email path.
5. **Purchase confirmation email** — reuse the existing mailer (mailpit in dev): receipt + library
   link on `settleOrder()` success (best-effort, non-blocking).

## Key Files
- `next-app/lib/entitlements.ts` (+ tests)
- `next-app/app/(dashboard)/dashboard/library/page.tsx` + `[slug]/page.tsx`
- `next-app/actions/entitlements.ts` (claim flow)
- `next-app/lib/billing/orders.ts` (email hook, extend)

## Acceptance Criteria
- [ ] Direct URL access to gated content without a paid order → blocked server-side (int test)
- [ ] Paid user sees the product in 內容庫 and can open the delivery page
- [ ] Guest purchase → signup/login with same email → claim → entitlement appears
- [ ] Confirmation email lands in mailpit with library link; settle succeeds even if mail fails
- [ ] `<DataTable>` used for the library list; modals convention respected for any CRUD
- [ ] Vitest + `test:int` for the guard; typecheck/lint/build green

## Cross-Epic
- E327 — source of `orders`/`entitlement_key`; extends `settleOrder()`
- E255-era RBAC posture — same live-DB re-read discipline (security-audit skill §8: never confuse
  authorization flag with ownership — entitlement is *ownership*, checked as such)

## Out of Scope
- Video hosting/DRM, drip-release scheduling, progress tracking (future epics)
- Refund-triggered revocation UI (status enum already supports it; wire later)
