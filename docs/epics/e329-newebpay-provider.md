# E329 — 藍新 NewebPay Provider（填上 resolver 保留槽位，一次性付款）

> Phase 77 · feature/backend · Cycle 35（數位產品/課程銷售頁 PRD，2026-07-12）
> Status: ⬜ pending
> Depends: E327

## Problem

`lib/billing/resolver.ts` reserves a `newebpay` slot that throws. The sales-page PRD requires 藍新
as a switchable gateway for the TW market (ECPay primary at launch — NewebPay is the second local
option, one env var away).

## Solution

1. **Provider** — `lib/billing/providers/newebpay.ts` implementing `PaymentProvider` for the
   **one-time path only** (MPG 幕前支付):
   - `createCheckout` → build TradeInfo params (MerchantID, MerchantOrderNo, Amt, ItemDesc, Email,
     ReturnURL, NotifyURL, Version 2.0) → **AES-256-CBC encrypt → TradeInfo**, **SHA256 →
     TradeSha** → return auto-submit HTML `<form>` to the MPG gateway (mirror `ecpay.ts`'s
     form-building pattern; sandbox vs prod URL by env)
   - `verifyWebhook` → recompute TradeSha over the posted TradeInfo, constant-time compare, AES
     decrypt, parse `Status=SUCCESS` + TradeNo/MerchantOrderNo
   - Subscription methods (`createSubscription`/`chargeRecurring`/`cancelSubscription`) throw a
     descriptive NotImplemented (documented; matches one-time-only launch scope)
2. **Resolver** — remove `newebpay` from `UNIMPLEMENTED_SLOTS`; keep `tappay` reserved.
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
- [ ] `BILLING_PROVIDER=newebpay` resolves (no throw); `tappay` still throws with clear message
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
- 藍新定期定額 (recurring) — future epic if subscriptions need a TW alternative to ECPay
- TapPay slot (stays reserved)
