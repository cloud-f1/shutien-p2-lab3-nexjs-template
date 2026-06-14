# Changelog

## Phase 56 — Modular Registry (2026-06)

### E240 — VitePress Dev-Docs Site
- Rebuilt `dev-docs/` as a VitePress (Vue/static) site
- Module catalog generated from `registry.json`
- Bilingual whitepaper (EN + 繁中)
- Interactive API playground Vue component
- Live-demo gallery with iframe embeds
- Deploy config for Cloudflare Pages

### E239 — Skill Drift Purge (Next.js)
- Purged stale FastAPI-era skills; updated all skills for Next.js stack

### E238 — Module Docs Closeout
- All Phase 56 modules have `docs` + `demo` manifest fields
- Build check verifies module doc coverage

### E237 — MCP AI Assembly
- MCP tool integrations for AI-powered workflows

### E236 — ECPay Billing Module
- ECPay payment adapter for Taiwan market

### E235 — Stripe Billing Module
- Stripe payment adapter (checkout sessions, webhooks, subscription sync)

### E234 — Admin Module (`@saas/admin`)
- User management admin panel
- 3-tier RBAC gating (admin-only)
- User table, role selector, delete-user action

### E233 — Account Module (`@saas/account`)
- User profile form, password change, danger-zone (delete account)
- Wired into dashboard `/settings` route

### E232 — Landing Module (`@saas/landing`)
- Marketing landing page: Hero, Features, Pricing, FAQ, CTA
- `app/(marketing)/` route group with nav and footer

### E231 — Billing Abstraction
- `lib/billing/PaymentProvider` interface
- `plans`, `subscriptions`, `payment_events` schema tables

### E230 — Module Manifest + `module-author` Skill
- `module.manifest.json` spec with full JSON Schema
- `pnpm module:validate` validates all manifests
- `install-*` skills for each Phase 56 module

### E229 — Registry Infrastructure
- `next-app/registry.json` following shadcn registry protocol
- `pnpm registry:build` validates + exports registry
