---
title: "Billing (ECPay 綠界) Module"
description: "ECPay 全方位金流 AIO 定期定額 billing integration — CheckMacValue (SHA256), 定期定額 recurring orders (PeriodType/Frequency/ExecTimes), dual notify route handlers (ReturnURL + PeriodReturnURL), renewal scheduler, and idempotent event processing. Taiwan-local PaymentProvider for the @saas stack."
---

# 📦 Billing (ECPay 綠界)

<div class="module-card-tags" style="margin-bottom: 1rem;"><span class="module-card-tag">Database</span> <span class="module-card-tag">Env Vars</span></div>

> **Module ID:** `@saas/billing-ecpay` | **Version:** 1.0.0

ECPay 全方位金流 AIO 定期定額 billing integration — CheckMacValue (SHA256), 定期定額 recurring orders (PeriodType/Frequency/ExecTimes), dual notify route handlers (ReturnURL + PeriodReturnURL), renewal scheduler, and idempotent event processing. Taiwan-local PaymentProvider for the @saas stack.

## Installation

```bash
npx shadcn@latest add @saas/billing-ecpay
```

## Dependencies

- `@saas/billing`

## Routes

- `app/api/billing/ecpay/return/route.ts`
- `app/api/billing/ecpay/period/route.ts`

## Server Actions

_No server actions_

## Database Tables

- `plans`
- `subscriptions`
- `payment_events`

## Environment Variables

- `[object Object]`
- `[object Object]`
- `[object Object]`
- `[object Object]`
- `[object Object]`
- `[object Object]`

## Post-Install Steps

**Step 1** (env-wire): Add ECPAY_MERCHANT_ID, ECPAY_HASH_KEY, ECPAY_HASH_IV to .env.local. Use sandbox values for development (MerchantID: 3002607). Never commit to git.

**Step 2** (command): Set BILLING_PROVIDER=ecpay in .env.local to activate the ECPay provider.
```bash
echo 'BILLING_PROVIDER=ecpay' >> .env.local
```

**Step 3** (db-generate): Generate Drizzle migrations for the billing tables (plans, subscriptions, payment_events). These tables are shared with @saas/billing — skip if already migrated.
```bash
pnpm db:generate
```

**Step 4** (db-migrate): Apply billing migrations to your database.
```bash
pnpm db:migrate
```

**Step 5** (manual): planId format for createCheckout: '{interval}:{amountTWD}:{description}' e.g. 'month:299:Pro Plan'. The amount must be a positive integer (TWD). Wire your pricing tiers to use this format as planId.

**Step 6** (manual): Register notify URLs in ECPay 廠商管理後台 → 系統開發設定: ReturnURL = https://yourdomain.com/api/billing/ecpay/return, PeriodReturnURL = https://yourdomain.com/api/billing/ecpay/period. For local dev use ngrok or similar tunneling.

**Step 7** (manual): Renewal scheduler: set up a cron job (e.g. /api/cron/billing-reconcile) that calls provider.queryAndCheckRenewal(merchantTradeNo) for each active ECPay subscription. When needsRenewal=true, call provider.createCheckout() again to build a new 定期定額 order and send the consumer a re-subscribe link.

**Step 8** (manual): ExecTimes caps: D/M periods max 999, Y periods max 99. The renewal scheduler rebuilds before exhaustion (default threshold: remaining < 3). Adjust ECPAY_RENEWAL_THRESHOLD as needed.

**Step 9** (manual): Sandbox testing: use ECPay's test credit card (4311-9522-2222-2222, CVV 222, exp 2099/01) to simulate 定期定額 payments. Sandbox PeriodReturnURL is triggered automatically for the first 3 test cycles.

**Step 10** (command): Run typecheck and lint to verify no import errors.
```bash
pnpm typecheck && pnpm lint
```

## Live Demo

<DemoIframe path="/demo/billing-ecpay" title="Billing (ECPay 綠界) — Live Demo" :height="550" />

## API Demonstration

<ApiPlayground
  defaultEndpoint="/api/billing/ecpay/return"
  defaultMethod="GET"
  liveAppPath="/demo/billing-ecpay"
/>

> **Server Actions note:** Server Actions (`"use server"`) are not callable
> cross-origin. Use the "Try in Live App" link above to interact with them.
