# E327 — 一次性購買：products/orders + 統一結帳（ECPay-first）

> Phase 77 · feature/backend · Cycle 35（數位產品/課程銷售頁 PRD，2026-07-12）
> Status: ⬜ pending

## Problem

Billing today is subscription-shaped (`plans`/`subscriptions`, E249). The sales-page PRD sells
**one-time purchases** of digital products. `PaymentProvider.createCheckout` already supports
one-time payments by contract, but there is no product/order data model, no unified checkout entry
point, and no thank-you/settlement flow. Launch gateway decision: **ECPay 綠界 primary**（user
decision 2026-07-12）— Stripe stays the code-level resolver default; deployments set
`BILLING_PROVIDER=ecpay`.

## Design References（實作前必讀）

- **Skills**: `.claude/skills/install-ecpay-billing/SKILL.md` · `install-stripe-billing/SKILL.md` ·
  `upgrade-stripe/SKILL.md`（既有 provider 的參數/簽章/webhook 慣例以 skill 記載為準）·
  `nextjs-saas-patterns`（defineAction pipeline）· `spec-first`（Drizzle+Zod contract-first）·
  `drizzle-migration-safety`
- **官方 API 文件（設計依據，實作時逐項核對，不憑記憶）**:
  - ECPay 全方位金流：https://developers.ecpay.com.tw/ — AioCheckOut 參數、CheckMacValue 演算、
    ReturnURL/OrderResultURL 語意（`ChoosePayment`、`TradeDesc` encoding 陷阱）
  - Stripe：https://docs.stripe.com/api/checkout/sessions/create（`mode: 'payment'`）+
    https://docs.stripe.com/webhooks（signature 驗證、event 冪等）

## SOLID — 共用金流 interface 的介面切分（本 epic 的契約前置工作）

現行 `lib/billing/provider.ts` 是一個 fat `PaymentProvider`（一次性 + 訂閱 + webhook + reconcile
全綁定）。一次性-only 的 gateway（E329 藍新）會被迫丟 NotImplemented stub — 違反 **LSP/ISP**。
本 epic 先做**不破壞既有實作**的介面切分：

- **ISP** — 拆成能力介面：`OneTimePaymentGateway`（`createCheckout` + `verifyWebhook`）與
  `SubscriptionGateway`（`createSubscription` + `chargeRecurring` + `cancelSubscription` +
  `reconcile`）；保留 `PaymentProvider = OneTimePaymentGateway & SubscriptionGateway` 作為
  向後相容別名 — **介面切分本身 stripe.ts / ecpay.ts 零修改**。
  （實作註記 2026-07-12：**一次性收款路徑**經 QA 判定需在兩個 provider 各加一個 additive 的
  `mode: "one-time"` 分支 — ECPay 走純 AioCheckOut 單筆訂單（無任何定期定額欄位）、Stripe 走
  `mode: 'payment'` + inline `price_data`；既有訂閱行為與既有測試完全不動。）
- **LSP** — 不再有「實作了介面卻 throw」的方法：做不到的能力就不實作該介面。
- **DIP** — `createOneTimeCheckout` / `settleOrder()` 只依賴 `OneTimePaymentGateway`，
  透過 resolver 取得，不 import 任何具體 provider。
- **OCP** — resolver 增加能力窄化入口：`resolveOneTime(key)`（三家皆可）與
  `resolveSubscription(key)`（僅 stripe/ecpay；選到 newebpay 在 **resolve 時即 fail-fast**
  給明確錯誤，而不是深入 request 後才 NotImplemented）。新增 gateway = 新增一個檔案 +
  resolver 一個 entry，checkout 流程零修改。
- **SRP** — 各 provider 檔只管自家協定轉換；訂單狀態機只住在 `lib/billing/orders.ts`。

## Solution

1. **Schema (Drizzle, per `drizzle-migration-safety`)**:
   - `products` — id, slug UNIQUE, name, description, amount (integer, minor units), currency
     (default `TWD`), active, `entitlement_key` (consumed by E328), timestamps
   - `orders` — id, product_id FK, user_id FK **nullable** (guest checkout by email), customer_email,
     customer_name, provider, provider_order_id, amount, currency, status
     (`pending|paid|failed|refunded`), paid_at, timestamps. Idempotent settlement rides the existing
     `payment_events.provider_event_id UNIQUE` — no new idempotency machinery.
   - Seed: 1 example product matching E326's example slug (dev seed only).
2. **Interface segregation**（上節 SOLID 方案落地）— `lib/billing/provider.ts` 拆出
   `OneTimePaymentGateway` / `SubscriptionGateway` + 相容別名；`lib/billing/resolver.ts` 加
   `resolveOneTime` / `resolveSubscription` 能力窄化入口（既有 `resolveProvider` 保留）。
   既有 provider.test.ts / resolver.test.ts 增測不改舊斷言。
3. **Unified checkout entry** — Server Action `createOneTimeCheckout` in `next-app/actions/checkout.ts`
   (via `defineAction`, `// stop-verifier:public-action` — guests may buy): Zod-validated payload
   (productSlug, email, name, gateway override optional) → creates `pending` order → resolver picks
   provider → `provider.createCheckout({ mode: "one-time", … })` → returns either `redirectUrl`
   (Stripe session URL) or `formHtml` (ECPay auto-submit form), matching the PRD's
   `UnifiedCheckoutPayload` semantics. Client helper renders/submits the form or redirects.
4. **Settlement** — extend the existing webhook routes (`/api/billing/ecpay/return`,
   `/api/billing/stripe/webhook`) with a shared `settleOrder()` helper (`lib/billing/orders.ts`):
   verifyWebhook → record `payment_events` → mark order `paid` + `paid_at` (idempotent). E329's
   NewebPay notify route reuses the same helper.
5. **感謝頁** — `app/p/[slug]/thanks/page.tsx`: reads order by id+email token, shows
   paid/pending state (ECPay return can race the notify — poll or refresh hint).
6. **ECPay-first ops**: `.env.example` sales section documents `BILLING_PROVIDER=ecpay`; QA runs the
   ECPay one-time flow first; deploy guide note (Zeabur env). Resolver code default (`stripe`)
   unchanged — no behavior change for existing installs.

## Key Files
- `next-app/lib/schema.ts` + `drizzle/migrations/*` (products, orders) + migration-review artifact
- `next-app/lib/billing/provider.ts` + `resolver.ts`（ISP 切分 + 能力窄化，向後相容）
- `next-app/actions/checkout.ts` · `next-app/lib/billing/orders.ts`
- `next-app/app/api/billing/ecpay/return/route.ts` · `.../stripe/webhook/route.ts` (extend)
- `next-app/app/p/[slug]/thanks/page.tsx` · `next-app/.env.example`

## Acceptance Criteria
- [ ] Migration generated + applies on fresh DB; migration-review artifact (Rule #19)
- [ ] `OneTimePaymentGateway`/`SubscriptionGateway` 切分落地；`PaymentProvider` 別名保住向後相容 —
      stripe.ts/ecpay.ts 零修改、既有 provider/resolver 測試全綠；`resolveSubscription("newebpay")`
      在 resolve 時 fail-fast（測試斷言錯誤訊息）
- [ ] `createOneTimeCheckout`/`settleOrder` 僅 import 介面型別與 resolver（DIP — 以
      `grep -r "from.*providers/" actions/ lib/billing/orders.ts` 為零佐證）
- [ ] `createOneTimeCheckout`: ECPay path returns auto-submit form HTML (CheckMacValue valid per
      existing ecpay util tests); Stripe path returns `mode: 'payment'` session URL
- [ ] Duplicate webhook delivery settles the order exactly once (`payment_events` UNIQUE test)
- [ ] Guest checkout works (no session); logged-in checkout links `user_id`
- [ ] 感謝頁 shows paid vs pending correctly for the return-races-notify case
- [ ] Vitest: payload Zod, settleOrder idempotency, provider dispatch; typecheck/lint/build green

## Cross-Epic
- E249 — implements the one-time half of the contract; refactors `PaymentProvider` into segregated
  capability interfaces **backward-compatibly**（既有 provider 零修改，型別別名保住舊契約）
- E326 — sales-page CTA calls `createOneTimeCheckout`
- E328 — consumes `orders.status='paid'` + `products.entitlement_key`
- E329 — NewebPay notify route reuses `settleOrder()`

## Out of Scope
- 交付開通/內容存取 → E328；NewebPay provider → E329
- Refund flows beyond status enum; invoicing/電子發票 (future epic)
