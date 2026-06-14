---
title: "Whitepaper — @saas Next.js Modular Registry Template"
description: "Full scope whitepaper: Next.js 16, modular registry, AI-composable development, and billing abstraction."
---

# @saas Template Whitepaper

**Next.js + Modular Registry + AI-Composable SaaS**

> Version 1.0 · June 2026 · [繁體中文版](/whitepaper/zh-TW)

---

## Executive Summary

The **@saas template** is a production-ready Next.js SaaS starter that collapses 2–4 weeks of
boilerplate into a single clone. Its three strategic axes are:

1. **Modular Registry** — install features as composable blocks via the shadcn registry protocol
2. **AI-Composable Development** — 12 specialized Claude Code agents automate the full spec→deploy pipeline
3. **Billing Abstraction** — a `PaymentProvider` interface lets you swap Stripe ↔ ECPay with one env var

This whitepaper documents the architecture, the Phase 56 module system, and the path forward.

---

## 1. Problem

Every SaaS project starts with the same baseline:

- Authentication (sign-up, sign-in, password reset, OAuth)
- Authorization (role-based access control)
- Database setup (schema, migrations, ORM)
- Admin panel (user management)
- Landing page (marketing surface)
- Payment integration (subscriptions, webhooks)
- Deployment pipeline (CI/CD, environment management)
- Developer tooling (testing, linting, type checking)

This infrastructure takes **2–4 weeks** to build correctly. Most teams rush it, accumulate tech debt, and spend the next year fixing auth bugs and RBAC gaps.

The @saas template eliminates this cost.

---

## 2. Solution Architecture

### 2.1 Next.js App Router (Next.js 16)

The template uses **Next.js 16 App Router** with:

- **React Server Components** (RSC) as the default — `"use client"` only for browser APIs, event handlers, state
- **Server Actions** (`"use server"`) for mutations — no REST layer needed for internal state
- **Route Handlers** (`app/api/`) for cross-origin callable endpoints (OAuth callbacks, webhooks)
- **Nested layouts** for route groups: `(auth)/`, `(dashboard)/`, `(marketing)/`

### 2.2 Modular Registry (E229–E230)

The registry follows the **shadcn/ui registry protocol**:

```
next-app/registry.json          — registry manifest (name, items)
next-app/registry/<id>/         — module source files
  module.manifest.json          — declares routes, actions, DB tables, env vars
  components/                   — React components
  actions/                      — Server Actions
  app/                          — route files
```

**Install a module:**

```bash
npx shadcn@latest add @saas/landing
```

This copies the module's files into your `next-app/`, following the `target` paths in `module.manifest.json`. No post-install script magic — pure file copy + manual wiring steps.

**Validate all manifests:**

```bash
pnpm module:validate     # validates JSON Schema + required fields
pnpm registry:build      # builds and validates the registry export
```

### 2.3 Authentication (NextAuth v5)

Authentication uses **NextAuth v5** with the JWT strategy:

- Sessions are **stateless** — no DB session table
- JWT stored in an httpOnly cookie (production) or in-memory (dev)
- OAuth providers: Google, GitHub (add more in `auth.config.ts`)
- Email/password via the `Credentials` provider with bcrypt

### 2.4 3-Tier RBAC

Roles: `viewer` → `editor` → `admin`

```ts
// lib/is-admin.ts
export const isAdmin = (role: string) => role === 'admin'
export const isEditor = (role: string) => ['editor', 'admin'].includes(role)

// lib/permissions.ts
export async function requireRole(minRole: Role): Promise<Session> {
  const session = await auth()
  if (!session) redirect('/login')
  if (!hasRole(session.user.role, minRole)) notFound()
  return session
}
```

Every gated Server Action calls `requireRole()` as its first line.

### 2.5 Billing Abstraction (E231)

The `PaymentProvider` interface normalizes billing across providers:

```ts
interface PaymentProvider {
  createCheckoutSession(params: CheckoutParams): Promise<{ url: string }>
  createPortalSession(params: PortalParams): Promise<{ url: string }>
  handleWebhook(payload: string, signature: string): Promise<WebhookEvent>
  syncSubscription(customerId: string): Promise<Subscription>
}
```

Switch providers with one env var: `PAYMENT_PROVIDER=stripe` or `PAYMENT_PROVIDER=ecpay`.

### 2.6 Database (Drizzle + PostgreSQL)

- **Drizzle ORM** — type-safe schema with zero runtime overhead
- **PostgreSQL 15** — production-grade, managed via Zeabur or self-hosted
- Migrations via `pnpm db:generate` + `pnpm db:migrate`
- Schema: `users`, `accounts`, `sessions`, `verificationTokens`, `plans`, `subscriptions`, `payment_events`

---

## 3. Phase 56 Module Catalog

Phase 56 ships four production modules via the registry:

| Module | Route | Description |
|--------|-------|-------------|
| `@saas/landing` | `/` | Marketing landing: Hero, Features, Pricing, FAQ, CTA |
| `@saas/account` | `/dashboard/settings` | Profile, password change, delete account |
| `@saas/admin` | `/dashboard/admin` | User table, role selector (admin-only) |
| `@saas/billing` | `/dashboard/billing` | Stripe/ECPay checkout + portal |

Each module ships a `module.manifest.json` declaring its complete interface:

```json
{
  "id": "landing",
  "version": "1.0.0",
  "routes": ["(marketing)/page.tsx"],
  "serverActions": [],
  "dbTables": [],
  "docs": "/docs/modules/landing",
  "demo": { "path": "/", "iframeSrc": "..." }
}
```

---

## 4. AI-Composable Development

The template pairs with **Claude Code** and a 12-agent AI team for automated development.

### 4.1 Epic-Driven Pipeline

```
/athena:spec "feature"    → spec design
/athena:implement         → TDD implementation
/athena:qa                → review + tests + acceptance
/athena:pr                → commit + PR
```

### 4.2 Agent Architecture

Each agent is a scoped Markdown file in `.claude/agents/` with YAML frontmatter defining:
- Model (sonnet / opus)
- Allowed tools
- Specific instructions and output format

Agents call sub-agents via the orchestrator and write results to `docs/context/` for cross-session persistence.

### 4.3 Memory System

Two-tier knowledge persistence:
- **Tier 0** (`~/.claude/template-memory/`) — cross-project wisdom, 15 curated lesson files
- **Tier 1** (`docs/context/`) — project-specific state, 16 context files

`/athena:promote` extracts high-signal lessons from Tier 1 → Tier 0 via the `@memory-curator` agent.

### 4.4 Effort Dial

`--effort <tier>` scales agent depth vs. cost:

| Tier | Concurrent | Iterations | Threshold |
|------|-----------|------------|-----------|
| `quick` | 1 | 1 | 0.80 |
| `standard` | 4 | 4 | 0.85 |
| `thorough` | 4 | 6 | 0.90 |
| `ultra` | 16 | 8 | 0.95 |

---

## 5. Developer Experience

### 5.1 Zero-Boilerplate Fork

```bash
git clone https://github.com/qwedsazxc78/ai-coding-nexjs-template.git
cd ai-coding-nexjs-template/next-app
pnpm install && pnpm dev
```

First epic in under an hour.

### 5.2 Quality Gates

- **Typecheck:** `pnpm typecheck` (zero errors enforced)
- **Lint:** `pnpm lint` (eslint-config-next)
- **Unit tests:** `pnpm test` (Vitest, ≥80% coverage gate)
- **E2E tests:** `pnpm test:e2e` (Playwright, smoke gate)
- **Stop Verifier:** 23 rules block completion on violations (console.log, RBAC gaps, etc.)

### 5.3 Module Validation

```bash
pnpm module:validate     # validates all module.manifest.json files
pnpm registry:build      # builds registry export + validates completeness
```

---

## 6. Deployment

The template deploys to **Zeabur** as a single service. Migrations run at startup.

The `dev-docs/` site (this documentation) deploys to **Cloudflare Pages** via the `gh-cf-deploy` skill.

See the [Deployment Guide](/docs/deployment) for full configuration.

---

## 7. Roadmap

| Phase | Focus |
|-------|-------|
| 57 | Teams + multi-tenant workspace |
| 58 | Notification system (in-app + email + webhooks) |
| 59 | Analytics dashboard + usage metrics |
| 60 | White-label theming + custom domain support |

---

## 8. Conclusion

The @saas template provides a production-grade foundation that any developer can fork and ship in days. Its modular registry, AI agent team, and billing abstraction combine to eliminate the most common SaaS boilerplate costs — letting you focus on what makes your product unique.

**Get started:** [Quick Start Guide](/docs/getting-started) · [Module Catalog](/modules/) · [GitHub](https://github.com/qwedsazxc78/ai-coding-nexjs-template)
