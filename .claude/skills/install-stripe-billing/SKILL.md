---
name: install-stripe-billing
description: >
  Install the @saas/billing-stripe module into this project. Reads module.manifest.json,
  wires env vars (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, price IDs), runs db migrations
  for the billing tables, and verifies the webhook route + checkout action are installed.
  No manual code changes required — the module is self-contained.
  Use after: npx shadcn@latest add @saas/billing-stripe
user-invocable: true
metadata:
  author: saas-template
  version: "1.0.0"
  epic: E235
---

# Install Stripe Billing Module

Installs the `@saas/billing-stripe` module after `npx shadcn@latest add @saas/billing-stripe`.

## Prerequisites

Run first:

```bash
npx shadcn@latest add @saas/billing-stripe
```

This installs:
- `lib/billing/providers/stripe.ts` — StripeProvider implementing PaymentProvider
- `app/api/billing/stripe/webhook/route.ts` — Webhook Route Handler (raw body + sig verify)
- `actions/billing.ts` — `createCheckoutSession` server action
- `registry/billing-stripe/module.manifest.json` — module manifest

The `stripe` npm package must also be present:

```bash
cd next-app
pnpm add stripe
```

## Phase 0 — Pre-flight check

Verify registry files were installed:

```bash
ls lib/billing/providers/stripe.ts || echo "WARN: registry files may not be installed yet. Run: npx shadcn@latest add @saas/billing-stripe"
ls app/api/billing/stripe/webhook/route.ts || echo "WARN: webhook route missing"
ls actions/billing.ts || echo "WARN: billing action missing"
```

Verify the billing abstraction (E231) is present:

```bash
ls lib/billing/provider.ts lib/billing/resolver.ts || echo "WARN: billing abstraction missing — E231 must be installed first"
```

Verify billing tables exist in schema.ts:

```bash
grep -q "plansTable\|subscriptionsTable\|paymentEventsTable" lib/schema.ts && echo "OK" || echo "WARN: billing tables missing in lib/schema.ts"
```

## Phase 1 — Wire environment variables

Add the following to `.env.local` (create if it doesn't exist):

```bash
# .env.local

# Stripe Billing (E235)
STRIPE_SECRET_KEY=sk_test_...          # From Stripe Dashboard → Developers → API Keys
STRIPE_WEBHOOK_SECRET=whsec_...        # From Stripe Dashboard → Webhooks → endpoint → Signing secret

# BILLING_PROVIDER selects the active adapter (default: stripe)
BILLING_PROVIDER=stripe

# Stripe Price IDs — copy from Stripe Dashboard → Products → Prices
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_PRO_YEARLY=price_...          # Optional
STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=price_...  # Optional
```

**NEVER commit .env.local to git.** Verify .gitignore contains `.env.local`.

## Phase 2 — Database migrations

The billing tables (plans, subscriptions, payment_events) must exist in the database.
They are defined in `lib/schema.ts` as part of E231.

Generate and apply the migration:

```bash
cd next-app
pnpm db:generate   # generates migration file in drizzle/
pnpm db:migrate    # applies to your DATABASE_URL
```

If migrations already exist (E231 was installed earlier), just verify:

```bash
pnpm db:migrate    # idempotent — skips applied migrations
```

## Phase 3 — Create Stripe products and prices

In the Stripe Dashboard (or via Stripe CLI):

```bash
# Create a Pro product + monthly price
stripe products create --name "Pro" --description "Pro plan for SaaS"
stripe prices create \
  --product prod_xxx \
  --unit-amount 2900 \
  --currency usd \
  --recurring[interval] month \
  --nickname "Pro Monthly"

# Copy the returned price_xxx to STRIPE_PRICE_ID_PRO_MONTHLY in .env.local
```

## Phase 4 — Register webhook endpoint in Stripe

### Production
1. Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://yourdomain.com/api/billing/stripe/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret (`whsec_...`) to `STRIPE_WEBHOOK_SECRET` in your deployment env

### Local development (Stripe CLI)

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# Forward webhooks to your local dev server
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook

# The CLI prints a whsec_... secret — add it to .env.local as STRIPE_WEBHOOK_SECRET

# Test with a trigger
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_succeeded
```

## Phase 5 — Wire pricing UI to checkout

Update `components/marketing/pricing.tsx` (DEFAULT_PRICING_TIERS) to use your Stripe price IDs
as `planId` values. The `createCheckoutSession` server action passes planId directly to Stripe
as the `price` in the checkout session.

Example:

```typescript
// components/marketing/pricing.tsx
import { DEFAULT_PRICING_TIERS } from "./pricing"

// Update the planId fields to your Stripe price IDs:
export const DEFAULT_PRICING_TIERS = [
  {
    planId: "free",  // Free tier — no checkout needed
    // ...
  },
  {
    planId: process.env.STRIPE_PRICE_ID_PRO_MONTHLY ?? "price_pro_monthly",
    name: "Pro",
    // ...
  },
  {
    planId: process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY ?? "price_enterprise_monthly",
    name: "Enterprise",
    // ...
  },
]
```

To wire up the checkout button, replace the static `ctaHref` with a form action:

```tsx
// In your pricing card component, replace the Link with a form:
import { createCheckoutSession } from "@/actions/billing"

// Usage in a client component or form:
<form action={async () => {
  "use server"
  const result = await createCheckoutSession(
    tier.planId,
    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=canceled`,
  )
  if (result.checkoutUrl) {
    redirect(result.checkoutUrl)
  }
}}>
  <Button type="submit">{tier.ctaLabel}</Button>
</form>
```

## Phase 6 — Plan seeding (optional)

To seed your `plans` table with the Stripe price IDs:

```typescript
// drizzle/seed-billing.ts
import { db } from "@/lib/db"
import { plansTable } from "@/lib/schema"

await db.insert(plansTable).values([
  {
    providerPriceId: process.env.STRIPE_PRICE_ID_PRO_MONTHLY!,
    interval: "month",
    amount: 2900,
    currency: "usd",
    active: true,
  },
  {
    providerPriceId: process.env.STRIPE_PRICE_ID_PRO_YEARLY!,
    interval: "year",
    amount: 29000,
    currency: "usd",
    active: true,
  },
]).onConflictDoNothing()
```

## Phase 7 — Verify

```bash
cd next-app && pnpm typecheck && pnpm lint
```

Run the unit tests:

```bash
cd next-app && pnpm test lib/billing/providers/stripe.test.ts
```

Expected: all signature-verify, idempotency, and lifecycle tests pass.

Manual verification:
1. Start the dev server: `pnpm dev`
2. Start Stripe CLI: `stripe listen --forward-to localhost:3000/api/billing/stripe/webhook`
3. Visit `/` → click a paid plan's CTA → expect redirect to Stripe Checkout
4. Complete a test checkout with card `4242 4242 4242 4242` → expect redirect to success URL
5. Check the database: `pnpm db:studio` → verify `subscriptions` row was created

## Module manifest reference

```bash
cat registry/billing-stripe/module.manifest.json | jq .
```

Key fields:
- `registryDependencies`: `["@saas/billing"]` — depends on E231 PaymentProvider abstraction
- `npmDependencies`: `{"stripe": "^22.0.0"}`
- `envVars`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, plus optional price ID vars
- `dbTables`: `["plans", "subscriptions", "payment_events"]`
- `routes`: `["api/billing/stripe/webhook/route.ts"]`
- `serverActions`: `["actions/billing.ts"]`

## Troubleshooting

### "STRIPE_SECRET_KEY is not set"
Add `STRIPE_SECRET_KEY=sk_test_...` to `.env.local` and restart the dev server.

### "STRIPE_WEBHOOK_SECRET is not set"
Add `STRIPE_WEBHOOK_SECRET=whsec_...` to `.env.local`. For local dev, get this from
`stripe listen` output.

### "Invalid webhook signature"
Ensure the raw body is not being parsed before reaching the webhook handler.
The route handler uses `request.text()` before any JSON parsing — do not add middleware
that buffers or re-encodes the body.

### Webhook events not processing
1. Check Stripe Dashboard → Webhooks → your endpoint → Recent deliveries
2. Verify the correct events are subscribed (checkout.session.completed, etc.)
3. Check server logs for `processStripeEvent` errors
4. Verify `payment_events` table has the `provider_event_id` unique constraint applied

### Double-processing (idempotency issue)
The webhook handler inserts to `payment_events` with a UNIQUE constraint on `provider_event_id`.
If you see double-processing, ensure the migration was applied:

```bash
pnpm db:migrate
```

### Using `upgrade-stripe` skill for SDK upgrades
Run `/upgrade-stripe` or read `.claude/skills/upgrade-stripe.md` for guidance on:
- Upgrading the Stripe SDK version
- Updating the pinned API version (`apiVersion: "2026-02-25.clover"`)
- Migrating webhook handlers between API versions
