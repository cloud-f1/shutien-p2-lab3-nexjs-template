# Developer Guide

Welcome to the **@saas Next.js Template** developer documentation. This guide covers everything you need to develop, test, deploy, and extend the template.

## Quick Navigation

| Section | Description |
|---------|-------------|
| [Quick Start](./getting-started) | Clone → configure → run in 5 minutes |
| [API Guide](./api-guide) | Route handlers, Server Actions, auth patterns |
| [Testing](./testing) | Vitest unit + Playwright e2e, coverage gate |
| [Deployment](./deployment) | Zeabur deployment, env vars, zero-downtime |
| [Changelog](./changelog) | Version history and migration notes |

## Guides

| Guide | Description |
|-------|-------------|
| [Quick Start (Guide)](./guides/quickstart) | Step-by-step first run |
| [First Epic Walkthrough](./guides/first-epic) | Full epic pipeline demo |
| [Deploy Guide](./guides/deploy-guide) | Production deployment checklist |
| [Fork Security Setup](./guides/fork-security) | Secure your fork for production |
| [Memory System](./guides/memory-system) | How agent memory tiers work |
| [AI Agent Team](./guides/ai-agent-team) | 12 agents — roles and invocation |
| [Custom Agents](./guides/custom-agents) | Author your own Claude Code agents |
| [Autopilot Mode](./guides/autopilot) | Confidence-gated auto-execution |

## Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 App Router |
| **UI** | React 19 + TypeScript + Tailwind v4 + shadcn/ui |
| **Auth** | NextAuth v5 (JWT, stateless) |
| **Database** | Drizzle ORM + PostgreSQL 15 |
| **RBAC** | 3-tier: viewer / editor / admin |
| **Billing** | PaymentProvider abstraction (Stripe + ECPay) |
| **Tests** | Vitest + Playwright (>=80% coverage gate) |
| **Deploy** | Zeabur (one service, `next-app/`) |
| **AI Dev** | Claude Code + 12 specialized agents |
