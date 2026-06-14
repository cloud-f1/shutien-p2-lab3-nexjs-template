---
title: "Billing (Stripe) Module"
description: "Stripe billing integration — Checkout sessions, subscription lifecycle, signed webhooks (HMAC-SHA256 via stripe.webhooks.constructEvent), and idempotent event processing. DEFAULT PaymentProvider for the @saas stack."
---

# 📦 Billing (Stripe)

<div class="module-card-tags" style="margin-bottom: 1rem;"><span class="module-card-tag">Database</span> <span class="module-card-tag">Server Actions</span> <span class="module-card-tag">Env Vars</span></div>

> **Module ID:** `@saas/billing-stripe` | **Version:** 1.0.0

Stripe billing integration — Checkout sessions, subscription lifecycle, signed webhooks (HMAC-SHA256 via stripe.webhooks.constructEvent), and idempotent event processing. DEFAULT PaymentProvider for the @saas stack.

## Installation

```bash
npx shadcn@latest add @saas/billing-stripe
```

## Dependencies

- `@saas/billing`

## Routes

- `api/billing/stripe/webhook/route.ts`

## Server Actions

- `actions/billing.ts`

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

## Post-Install Steps

**Step 1** (env-wire): Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and price ID vars to .env.local. Never commit these to git.

**Step 2** (command): Set BILLING_PROVIDER=stripe in .env.local (this is the default, but be explicit).
```bash
echo 'BILLING_PROVIDER=stripe' >> .env.local
```

**Step 3** (db-generate): Generate Drizzle migrations for the billing tables (plans, subscriptions, payment_events).
```bash
pnpm db:generate
```

**Step 4** (db-migrate): Apply the billing migrations to your database.
```bash
pnpm db:migrate
```

**Step 5** (manual): Create products and prices in the Stripe Dashboard (or use the Stripe CLI: stripe prices create ...). Copy the price IDs to your .env.local as STRIPE_PRICE_ID_* vars.

**Step 6** (manual): Register the webhook endpoint in Stripe Dashboard → Webhooks → Add endpoint. URL: https://yourdomain.com/api/billing/stripe/webhook. Events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed.

**Step 7** (manual): For local development, use Stripe CLI to forward webhooks: stripe listen --forward-to localhost:3000/api/billing/stripe/webhook. Copy the whsec_... signing secret to STRIPE_WEBHOOK_SECRET in .env.local.

**Step 8** (manual): Update pricing tiers in components/marketing/pricing.tsx (DEFAULT_PRICING_TIERS) to use your Stripe price IDs as planId values, so the checkout server action routes to the correct Stripe price.

**Step 9** (command): Run typecheck and lint to verify no import errors.
```bash
pnpm typecheck && pnpm lint
```

**Step 10** (docs): Read the billing-stripe module docs for full integration guide and testing instructions.

## Live Demo

<DemoIframe path="/demo/billing" title="Billing (Stripe) — Live Demo" :height="550" />

## API Demonstration

<ApiPlayground
  defaultEndpoint="/api/billing/stripe/webhook"
  defaultMethod="GET"
  liveAppPath="/demo/billing"
/>

> **Server Actions note:** Server Actions (`"use server"`) are not callable
> cross-origin. Use the "Try in Live App" link above to interact with them.
