# E251 — Stripe Billing Module (DEFAULT)

**Phase:** 58 | **Status:** ⬜ | **Depends:** E249, E250

## Problem

We need the default, reference billing implementation. Stripe Billing provides subscription
lifecycle, invoices, and signed webhooks — the bar every other provider is measured against.

## Solution

- `lib/billing/providers/stripe.ts`: implements `PaymentProvider` — Checkout Session,
  subscription lifecycle, `cancelSubscription`, `verifyWebhook` (Stripe-Signature `t=`/`v1=`
  HMAC-SHA256 via `stripe.webhooks.constructEvent`), `reconcile` (API re-fetch).
- Webhook **Route Handler** `app/api/billing/stripe/webhook/route.ts` (raw body):
  verify signature → idempotency check against `payment_events.provider_event_id` →
  tolerate out-of-order (re-fetch subscription on each relevant event) → upsert `subscriptions`.
- Pricing UI wired to E249 `plans` + E250 pricing section; checkout server action.
- Leverage existing `.claude/skills/upgrade-stripe.md` + `docs/examples/domains/.../billing.ts`.
- `install-stripe-billing` consumer skill: env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  price IDs), `stripe listen` for local webhooks, plan seeding.

## Acceptance

- [ ] Stripe provider implements full `PaymentProvider`; `BILLING_PROVIDER=stripe` (default) works in test mode end-to-end
- [ ] webhook Route Handler verifies signature, is idempotent (event-id), tolerates out-of-order
- [ ] checkout → subscription row created; cancel → status updated; reconcile re-syncs from API
- [ ] packaged as `@saas/billing-stripe` (registryDependency: E249) + manifest + install skill
- [ ] Vitest: signature verify + idempotency + lifecycle; e2e: pricing → checkout redirect
- [ ] contributes a docs page + iframe live-demo + API-demonstration entry to the E240 VitePress site (via manifest `docs`/`demo`)

## Official Integration Skill (use this)

**Stripe official AI skills:** https://github.com/stripe/ai/tree/main/skills — 4 skills:
`stripe-best-practices`, `stripe-directory`, `stripe-projects`, `upgrade-stripe` (agent skills synced
from Stripe docs; pair with Stripe's `search_stripe_documentation` tool / MCP).

- The implementer MUST install + follow these for the checkout / subscription-lifecycle / **webhook
  signature-verify + idempotency** patterns rather than improvising.
- Note: the repo already has `.claude/skills/upgrade-stripe.md` — that is the `upgrade-stripe` skill
  from this source; add the other three (e.g. via `skills-lock.json` source `stripe/ai`,
  `skillPath: skills/<name>/SKILL.md`).
- Installing touches the skill layer → run with the `.claude` + skills permission (interactive lane).
