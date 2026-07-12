# E329 — 藍新 NewebPay Provider（填上 resolver 保留槽位，一次性付款）

> Phase 77 · feature/backend · Cycle 35（數位產品/課程銷售頁 PRD，2026-07-12）
> Status: ⬜ pending
> Depends: E327

## Problem

`lib/billing/resolver.ts` reserves a `newebpay` slot that throws. The sales-page PRD requires 藍新
as a switchable gateway for the TW market (ECPay primary at launch — NewebPay is the second local
option, one env var away).

## Design References（實作前必讀）

- **Skills**: `.claude/skills/install-ecpay-billing/SKILL.md`（ECPay provider 的 form-post/簽章/
  webhook 慣例是本檔的結構範本）· `security-audit`（webhook 驗證面）
- **官方 API 文件（設計依據，實作時逐項核對，不憑記憶）**:
  - 藍新 NewebPay MPG 幕前支付串接手冊：https://www.newebpay.com/website/Page/content/download_api
    — TradeInfo AES-256-CBC 加密（HashKey/HashIV）、TradeSha = SHA256(`HashKey=...&{TradeInfo}&HashIV=...`)
    大寫、`Version 2.0`、NotifyURL/ReturnURL 語意、回傳 `Status=SUCCESS` 判定、測試/正式站 URL
  - 對照 `lib/billing/providers/ecpay.ts` 的既有實作慣例（env 讀取、form HTML 產生、錯誤處理）

## SOLID 契約（接 E327 的介面切分）

本 provider **只實作 `OneTimePaymentGateway`**（`createCheckout` + `verifyWebhook`）— 不實作
`SubscriptionGateway`、**沒有任何 NotImplemented stub**（LSP：實作了的介面每個方法都真的能跑）。
訂閱需求走 `resolveSubscription()`，選到 newebpay 時 resolver 端 fail-fast（E327 已鋪好）。
新增本 gateway 對 checkout/settle 流程**零修改**（OCP）：一個新檔 + resolver entry + notify route。

## Solution

1. **Provider** — `lib/billing/providers/newebpay.ts` implementing **`OneTimePaymentGateway`**
   (MPG 幕前支付):
   - `createCheckout` → build TradeInfo params (MerchantID, MerchantOrderNo, Amt, ItemDesc, Email,
     ReturnURL, NotifyURL, Version 2.0) → **AES-256-CBC encrypt → TradeInfo**, **SHA256 →
     TradeSha** → return auto-submit HTML `<form>` to the MPG gateway (mirror `ecpay.ts`'s
     form-building pattern; sandbox vs prod URL by env)
   - `verifyWebhook` → recompute TradeSha over the posted TradeInfo, constant-time compare, AES
     decrypt, parse `Status=SUCCESS` + TradeNo/MerchantOrderNo
   - No subscription methods at all — the class implements only `OneTimePaymentGateway`
     (E327's ISP split; LSP-clean, no throwing stubs)
2. **Resolver** — register newebpay in `resolveOneTime()`; `resolveSubscription("newebpay")` keeps
   failing fast with a descriptive error; keep `tappay` fully reserved.
3. **Notify route** — `app/api/billing/newebpay/return/route.ts`: `verifyWebhook` →
   `settleOrder()` (E327 shared helper) → respond per NewebPay ack spec.
4. **Env** — `NEWEBPAY_MERCHANT_ID` / `NEWEBPAY_HASH_KEY` / `NEWEBPAY_HASH_IV` (+ sandbox flag) in
   `.env.example` with 藍新後台 setup notes.
5. **Tests** — mirror `ecpay.test.ts`: known-vector AES/SHA fixtures (official doc sample), round-trip
   encrypt→verify, tampered-TradeSha rejection, resolver returns provider, contract test vs
   `provider.test.ts` shape.

## Key Files
- `next-app/lib/billing/providers/newebpay.ts` (+ `newebpay.test.ts`)
- `next-app/lib/billing/resolver.ts` (+ test update)
- `next-app/app/api/billing/newebpay/return/route.ts`
- `next-app/.env.example`

## Acceptance Criteria
- [ ] `resolveOneTime("newebpay")` resolves; `resolveSubscription("newebpay")` + `tappay` still
      fail fast with clear messages; provider has zero NotImplemented stubs (LSP)
- [ ] Known-vector test: TradeInfo/TradeSha match official sample; tampered payload rejected
- [ ] Notify route settles an E327 order idempotently (duplicate POST → single `paid`)
- [ ] Sandbox 實測 checklist documented in the epic/deploy notes (real 藍新 sandbox run is a
      human step — record result in deploy-log)
- [ ] No secrets in code; crypto via Node `crypto` (no new deps unless justified)
- [ ] Vitest green incl. existing ecpay/stripe suites untouched; typecheck/lint/build green

## Cross-Epic
- E249 — fills the reserved slot exactly as the contract intended; zero interface change
- E327 — settlement path + orders; E327's `settleOrder()` must land first (hard dep)

## Out of Scope
- 藍新定期定額 (recurring) — future epic implementing `SubscriptionGateway` if subscriptions need a
  TW alternative to ECPay
- TapPay slot (stays reserved)
- `@saas/newebpay-billing` registry module + `install-newebpay-billing` skill（與 ecpay/stripe
  billing 模組對齊的封裝）— follow-up epic，baked-in provider 先行
