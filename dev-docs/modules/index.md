---
title: Module Catalog
description: Browse all @saas registry modules — installable building blocks for your Next.js SaaS.
---

# Module Catalog

Browse and install @saas registry modules. Each module is an installable block
that wires routes, server actions, and database tables into your Next.js app via
the shadcn registry protocol.

```bash
# Install any module
npx shadcn@latest add @saas/<module-id>
```

## Phase 56 Modules

<div class="module-catalog">

<ModuleCard
  id="billing-stripe"
  title="Billing (Stripe)"
  summary="Stripe billing integration — Checkout sessions, subscription lifecycle, signed webhooks (HMAC-SHA256 via stripe.webhooks.constructEvent), and idempotent event processing. DEFAULT PaymentProvider for the @saas stack."
  icon="📦"
  :tags="['Database','Server Actions','Env Vars']"
  docsPath="/modules/billing-stripe"
  demoPath="/demo/billing-stripe"
/>

<ModuleCard
  id="billing-ecpay"
  title="Billing (ECPay 綠界)"
  summary="ECPay 全方位金流 AIO 定期定額 billing integration — CheckMacValue (SHA256), 定期定額 recurring orders (PeriodType/Frequency/ExecTimes), dual notify route handlers (ReturnURL + PeriodReturnURL), renewal scheduler, and idempotent event processing. Taiwan-local PaymentProvider for the @saas stack."
  icon="📦"
  :tags="['Database','Env Vars']"
  docsPath="/modules/billing-ecpay"
  demoPath="/demo/billing-ecpay"
/>

<ModuleCard
  id="landing"
  title="Landing Page"
  summary="Public marketing landing page with Hero, Features, Pricing, FAQ, and CTA sections inside an app/(marketing)/ route group."
  icon="🏠"
  :tags="[]"
  docsPath="/modules/landing"
  demoPath="/demo/landing"
/>

</div>

## How Modules Work

1. **Declare** — each module ships a `module.manifest.json` declaring its routes,
   server actions, DB tables, env vars, and post-install steps.
2. **Install** — run `npx shadcn@latest add @saas/<id>` to copy files into your
   `next-app/`.
3. **Wire** — follow the post-install steps (sidebar nav, auth primitives, etc.)
4. **Extend** — override components, add routes, build on top.

## Build Check

The `pnpm registry:build` command validates that every shipped module has:
- A `module.manifest.json` with `docs` + `demo` fields
- A docs page in `dev-docs/modules/<id>.md`
- A demo entry in `dev-docs/demo/<id>.md`
