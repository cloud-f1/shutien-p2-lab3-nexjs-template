---
name: install-ecpay-billing
version: "1.0.0"
description: >
  Install the @saas/billing-ecpay module into this Next.js SaaS project.
  Wires ECPay 綠界 全方位金流 AIO 定期定額 recurring billing:
  - lib/billing/providers/ecpay.ts (EcpayProvider implementing PaymentProvider)
  - app/api/billing/ecpay/return/route.ts (ReturnURL — first auth notify)
  - app/api/billing/ecpay/period/route.ts (PeriodReturnURL — each cycle notify)
  - Registers ecpay in resolver.ts (BILLING_PROVIDER=ecpay)
  - Documents env vars (ECPAY_MERCHANT_ID, ECPAY_HASH_KEY, ECPAY_HASH_IV)
  - Notes on renewal scheduler cron job
triggers:
  - "install ecpay billing"
  - "add ecpay"
  - "wire ecpay"
  - "set up ecpay recurring"
  - "定期定額"
---

# Install ECPay Billing Module (@saas/billing-ecpay)

> ⚠️ **READ FIRST — ECPay billing is pre-installed in THIS template, and the
> registry copy is OLDER.** In this repo the *live* code already exists at
> `lib/billing/providers/ecpay.ts`, `app/api/billing/ecpay/return/route.ts`, and
> `app/api/billing/ecpay/period/route.ts` — and it has **diverged from and is
> newer than** the `registry/billing-ecpay/**` copy. The live provider is wired
> into the full template billing stack (`resolver.ts`, `period-utils.ts`,
> `reconcile-utils.ts`, audit logging) that the standalone registry copy does NOT ship.
>
> - **In THIS template:** ECPay billing is **already installed — do NOT run
>   `npx shadcn@latest add @saas/billing-ecpay` here.** Doing so **overwrites the
>   newer live files with the older registry copy** and can break imports. Skip the
>   install and go straight to env wiring + notify-URL setup (Steps 2–9) against
>   the existing code.
> - **In a fresh project:** the registry copy is the self-contained starting
>   point — install it and follow all steps.

This skill installs and verifies the ECPay 綠界科技 billing module for Taiwan-local recurring billing (定期定額).

## Prerequisites

- E231 PaymentProvider abstraction is installed (`lib/billing/provider.ts` exists)
- E235 Stripe provider is present (as reference implementation)
- DB tables `plans`, `subscriptions`, `payment_events` exist (from E231)

## Step 1: Install via shadcn registry

The `@saas` registry is served by the template app at `/r/*`, so set
`SAAS_REGISTRY_URL` to a running origin first (`http://localhost:3000` with
`pnpm dev` running — the `.env.example` default — for local installs, or your
deployed domain for a hosted registry). Then, **in a fresh project only** (see the
warning above — skip this in THIS template):

```bash
cd next-app
npx shadcn@latest add @saas/billing-ecpay
```

This copies:
- `lib/billing/providers/ecpay.ts`
- `app/api/billing/ecpay/return/route.ts`
- `app/api/billing/ecpay/period/route.ts`
- `registry/billing-ecpay/module.manifest.json`

## Step 2: Wire resolver

Read `next-app/lib/billing/resolver.ts`. Confirm the `ecpay` case imports `getEcpayProvider`:

```typescript
case "ecpay": {
  const { getEcpayProvider } = await import("./providers/ecpay")
  return getEcpayProvider()
}
```

If the case still throws, edit it to match the above.

## Step 3: Configure environment variables

Add to `next-app/.env.local`:

```bash
# ECPay 綠界 AIO 金流
BILLING_PROVIDER=ecpay
ECPAY_MERCHANT_ID=3002607              # sandbox; use your real ID in production
ECPAY_HASH_KEY=pwFHCqoQZGmho4w6       # sandbox; get from ECPay 廠商後台
ECPAY_HASH_IV=EkRm7iFT261dpevs        # sandbox; get from ECPay 廠商後台
ECPAY_API_BASE_URL=https://payment-stage.ecpay.com.tw  # sandbox; remove for production
ECPAY_RENEWAL_THRESHOLD=3             # rebuild order when remaining periods < 3
```

**Production values** — get from ECPay 廠商管理後台 → 系統開發設定:
- `ECPAY_MERCHANT_ID`: your real merchant ID
- `ECPAY_HASH_KEY`: your real Hash Key
- `ECPAY_HASH_IV`: your real Hash IV
- Remove `ECPAY_API_BASE_URL` (defaults to production URL)

## Step 4: Register notify URLs

In ECPay 廠商管理後台 → 系統開發設定 → 付款完成通知網址:

- **ReturnURL** (first auth): `https://yourdomain.com/api/billing/ecpay/return`
- **PeriodReturnURL** (each cycle): `https://yourdomain.com/api/billing/ecpay/period`

For local development, use ngrok or Cloudflare Tunnel:
```bash
npx cloudflared tunnel --url http://localhost:3000
```
Then register the tunnel URL as ReturnURL.

## Step 5: Plan ID format

ECPay planId uses a colon-separated format: `"{interval}:{amountTWD}:{description}"`

Examples:
- `"month:299:Pro Plan"` — NT$299/month
- `"year:2990:Pro Annual"` — NT$2,990/year
- `"day:99:Daily Access"` — NT$99/day

Wire your pricing tiers in `components/marketing/pricing.tsx`:
```typescript
const PRICING_TIERS = [
  {
    planId: "month:299:Pro Plan",
    name: "Pro",
    price: 299,
    interval: "month",
  },
]
```

## Step 6: Database (no new migrations needed)

ECPay uses the same `plans`, `subscriptions`, `payment_events` tables from E231.
The `provider_meta` JSONB column stores ECPay-specific state:

```typescript
// ECPay subscription provider_meta shape
{
  merchant_trade_no: string,    // ECPay's MerchantTradeNo (= providerSubId)
  ecpay_trade_no: string,       // ECPay's TradeNo
  exec_times: number,           // max periods (999 for D/M, 99 for Y)
  total_success_times: number,  // successful periods so far
  exec_status: "0"|"1"|"2",    // 0=terminated, 1=running, 2=completed
  period_type: "D"|"M"|"Y",    // D=day, M=month, Y=year
  renewal_threshold: number,    // rebuild threshold (default 3)
  needs_renewal: boolean,       // set true when remaining < threshold
}
```

## Step 7: Renewal scheduler (IMPORTANT)

ECPay 定期定額 has a hard cap: D/M periods max **999**, Y periods max **99**.
There is **no ECPay webhook when ExecTimes is exhausted** — you must detect it.

Set up a scheduled cron job that runs daily:

```typescript
// Example: app/api/cron/billing-reconcile/route.ts
import { getEcpayProvider } from "@/lib/billing/providers/ecpay"
import { db } from "@/lib/db"
import { subscriptionsTable } from "@/lib/schema"
import { eq, and } from "drizzle-orm"

export async function GET() {
  const provider = getEcpayProvider()

  // Fetch all active ECPay subscriptions
  const subs = await db.select().from(subscriptionsTable).where(
    and(
      eq(subscriptionsTable.provider, "ecpay"),
      eq(subscriptionsTable.status, "active"),
    )
  )

  for (const sub of subs) {
    const meta = sub.providerMeta as Record<string, unknown>
    const merchantTradeNo = meta.merchant_trade_no as string

    const status = await provider.queryAndCheckRenewal(merchantTradeNo)

    if (status?.needsRenewal) {
      // Build a new 定期定額 order and send re-subscribe link to user
      // This avoids double-charging: the new order starts AFTER the old one ends
      console.log(`Subscription ${sub.id} needs renewal`)

      // Update DB to mark pending renewal
      await db.update(subscriptionsTable).set({
        providerMeta: { ...meta, needs_renewal: true },
        updatedAt: new Date(),
      }).where(eq(subscriptionsTable.id, sub.id))
    }
  }

  return Response.json({ reconciled: subs.length })
}
```

Schedule this via Vercel Cron (`vercel.json`):
```json
{
  "crons": [{ "path": "/api/cron/billing-reconcile", "schedule": "0 2 * * *" }]
}
```
Or use Zeabur Cron Trigger.

## Step 8: Sandbox testing

1. Set sandbox env vars (Step 3)
2. Start dev server: `pnpm dev`
3. Create a test checkout via your pricing page
4. Use ECPay sandbox credit card: `4311-9522-2222-2222` CVV `222` exp `2099/01`
5. After payment, ECPay posts to ReturnURL (`/api/billing/ecpay/return`) — check DB for subscription row
6. ECPay sandbox triggers PeriodReturnURL for 3 test cycles automatically

## Step 9: Verify installation

Run QA gates:

```bash
cd next-app

# Typecheck
pnpm typecheck

# Lint
pnpm lint

# Unit tests (includes CheckMacValue test vectors)
pnpm test

# Verify provider resolves
node -e "
process.env.BILLING_PROVIDER='ecpay';
process.env.ECPAY_MERCHANT_ID='3002607';
process.env.ECPAY_HASH_KEY='pwFHCqoQZGmho4w6';
process.env.ECPAY_HASH_IV='EkRm7iFT261dpevs';
import('./lib/billing/resolver.js').then(r => r.resolvePaymentProvider()).then(p => console.log('Provider:', p.name));
"
```

Expected output: `Provider: ecpay`

## CheckMacValue algorithm (reference)

The official ECPay algorithm (from `guides/13-checkmacvalue.md`):

```
1. Remove CheckMacValue from params
2. Sort keys (case-insensitive)
3. Build: HashKey={key}&{k1=v1&k2=v2...}&HashIV={iv}
4. ecpayUrlEncode: encodeURIComponent → %20→+ → ~→%7e → '→%27 → toLowerCase → .NET replacements
5. SHA256 hash
6. toUpperCase()
```

TypeScript traps (vs PHP urlencode):
- `encodeURIComponent` leaves `~` and `'` unencoded → must replace manually
- `encodeURIComponent` encodes space as `%20` → must replace with `+`
- Test vectors validate these edge cases (see `ecpay.test.ts`)

## Files installed

| File | Purpose |
|------|---------|
| `lib/billing/providers/ecpay.ts` | EcpayProvider (PaymentProvider implementation) |
| `app/api/billing/ecpay/return/route.ts` | ReturnURL handler (first auth) |
| `app/api/billing/ecpay/period/route.ts` | PeriodReturnURL handler (each cycle) |
| `registry/billing-ecpay/module.manifest.json` | Module manifest with env vars + install steps |

## Env vars summary

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `ECPAY_MERCHANT_ID` | Yes | ECPay 特店編號 |
| `ECPAY_HASH_KEY` | Yes | CheckMacValue Hash Key |
| `ECPAY_HASH_IV` | Yes | CheckMacValue Hash IV |
| `ECPAY_API_BASE_URL` | No | API base URL (default: sandbox) |
| `ECPAY_RENEWAL_THRESHOLD` | No | Renewal trigger threshold (default: 3) |
| `BILLING_PROVIDER` | No | Set to `ecpay` (default: `stripe`) |
