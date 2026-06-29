# Template vs Product — what to keep, what to replace

This repo is **two things layered**: a reusable **Next.js + Athena template** (the *substrate*)
and whatever product you're building on it. When you fork to start a new product, knowing which
layer a file belongs to is the difference between a 30-minute rebrand and a week of confusion.
This page is the map. (See also: the `rebrand` skill, `/athena:new-project`, `scripts/new-project.sh`,
and the `athena:audit` Step 6b brand-staleness check.)

## The rule of thumb

- **Substrate = HOW you build** (auth, RBAC plumbing, the agent pipeline, the registry, CI, deploy). **Keep.**
- **Identity = WHAT you're building** (the domain, its rules, its screens, its name). **Replace.**

---

## Keep (substrate — carry into every fork)

| Area | Where | Note |
|---|---|---|
| Athena agent pipeline | `.claude/agents/`, `.claude/commands/athena/` | spec→implement→qa→commit→merge; `/athena:*` |
| Stack invariants | `next-app/` (App Router, RSC default, Drizzle, Auth.js v5 JWT, shadcn) | the architecture rules in CLAUDE.md |
| Auth/RBAC *plumbing* | `next-app/lib/auth.ts`, middleware, session guards | the *mechanism* (guards re-read live role); the *role names* are product identity |
| CRUD modal + DataTable convention | `app/(dashboard)/dashboard/items/`, `components/data-table-generic.tsx`, `components/confirm-dialog.tsx` | Dialog-first CRUD, no redirect pattern |
| CI / deploy | `.github/workflows/`, `deploy/`, `Makefile`, `zeabur-deploy` skill | ship-green; SHA-pinned actions; least-privilege |
| Memory + lifecycle skills | `rebrand`, `user-guide-builder`, `alignment-audit`, `mockup-to-epics`, `new-project` | the "build a product on this template" toolkit |
| Template PRD | `docs/PRD.md` | describes the *substrate*; keep as reference |
| Epic lifecycle hooks | `scripts/hooks/`, `.claude/settings.json` hooks | stop verifier, audit log, webhook — keep as-is or extend |
| Pre-merge quality gate | `scripts/pre-merge-check.sh` | repo hygiene + typecheck + lint + unit |

---

## Replace (identity — make it yours)

| Area | Where | How |
|---|---|---|
| Product name | `next-app/lib/branding.ts` `APP_NAME` default | the `rebrand` skill + `scripts/new-project.sh` |
| README intro + badges + repo URLs | `README.md` | repo slug (CI badge, clone lines, `socialLinks`, `editLink`) is the most-missed drift point |
| CLAUDE.md identity prose | `## What This Project Is` + `## Current State` | `/athena:new-project` judgment-half command |
| Dev-docs config | `dev-docs/.vitepress/config.mts` (title, description, domain, `socialLinks`, `editLink`) | `scripts/new-project.sh --apply` does scoped find/replace |
| Dev-docs landing | `dev-docs/index.md` (hero title, tagline) | same wizard pass |
| Role names | `next-app/lib/permissions.ts` role enum (here: admin/editor/viewer) | rename to match your product's access model |
| Permission flags | `next-app/lib/permissions.ts` flag matrix | replace the default 3-tier set with your product's rules |
| Seed demo accounts | `next-app/drizzle/seed.ts` | replace `admin@example.com`, `editor@example.com`, `viewer@example.com` with your demo credentials |
| Domain schema | `next-app/lib/schema/` | your tables (keep the `users`, `accounts`, `sessions` auth tables) |
| Domain screens | `next-app/app/(dashboard)/**` | your pages; the `items/` CRUD domain is a reference example — delete when you have your own |
| User manual | `dev-docs/guide-zh/**` | the `user-guide-builder` skill |

---

## Prune (template-only — delete if your product doesn't use them)

These are substrate *features* that not every product needs. Remove ones that don't apply to
cut noise for your fork team:

| Skill / File | When to prune |
|---|---|
| `install-ecpay-billing` | Remove if not integrating ECPay billing |
| `install-stripe-billing` | Remove if not integrating Stripe billing |
| `install-landing` | Remove if you have your own landing page approach |
| `module-author` | Remove if you won't publish `@saas/*` modules |
| `deploy-config` | Remove if you deploy only one way (keep the method you use) |
| `openapi-first.md` | Remove if you expose no external API |
| `upgrade-stripe.md` | Remove if not using Stripe |

---

## The two-layer gotchas

Forks of this template have demonstrated that the following slip through a naive name-sweep:

1. **Identity drifts on fork**: a product-name sweep misses the *repo slug* (CI badge URL,
   `socialLinks`, `editLink`, `git clone` examples) and the *docs domain*. Grep for all three,
   not just the product name. The `scripts/new-project.sh` wizard + `athena:audit` Step 6b enforce this.

2. **Two PRDs is intentional**: `docs/PRD.md` (substrate) is *not* your product PRD. Do not
   "fix" one to match the other — they describe different things. Each should cross-link the other.

3. **Role names vs RBAC plumbing**: the `admin/editor/viewer` role names in `lib/permissions.ts`
   are product identity (replace them). The guards in `lib/auth.ts` and middleware that re-read
   the role from the DB are substrate (keep the mechanism, swap the enum values).

4. **CLAUDE.md is a fork artifact**: the `## What This Project Is` and `## Current State` sections
   describe the template's own history. On fork, `/athena:new-project` rewrites them for your product.
   Leaving them verbatim means every future agent session carries the wrong context.
