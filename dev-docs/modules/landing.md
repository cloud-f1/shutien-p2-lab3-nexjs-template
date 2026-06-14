---
title: "Landing Page Module"
description: "Public marketing landing page with Hero, Features, Pricing, FAQ, and CTA sections inside an app/(marketing)/ route group."
---

# 🏠 Landing Page

<div class="module-card-tags" style="margin-bottom: 1rem;"></div>

> **Module ID:** `@saas/landing` | **Version:** 1.0.0

Public marketing landing page with Hero, Features, Pricing, FAQ, and CTA sections inside an app/(marketing)/ route group.

## Installation

```bash
npx shadcn@latest add @saas/landing
```

## Dependencies

- `button`
- `badge`
- `card`

## Routes

- `(marketing)/layout.tsx`
- `(marketing)/page.tsx`

## Server Actions

_No server actions_

## Post-Install Steps

**Step 1** (manual): Remove or archive the existing app/page.tsx placeholder — the landing module owns the / route via app/(marketing)/page.tsx.

**Step 2** (manual): Customise branding: update the site name in components/marketing/marketing-nav.tsx and components/marketing/marketing-footer.tsx.

**Step 3** (manual): Update pricing tiers in components/marketing/pricing.tsx (DEFAULT_PRICING_TIERS) to match your billing plans once the billing adapter is live.

**Step 4** (command): Run typecheck and lint to verify no import errors.
```bash
pnpm typecheck && pnpm lint
```

**Step 5** (docs): Read the landing module docs for theming and customisation guidance.

## Live Demo

<DemoIframe path="/" title="Landing Page — Live Demo" :height="550" />

## API Demonstration

<ApiPlayground
  defaultEndpoint="/api/demo/landing"
  defaultMethod="GET"
  liveAppPath="/"
/>

> **Server Actions note:** Server Actions (`"use server"`) are not callable
> cross-origin. Use the "Try in Live App" link above to interact with them.
