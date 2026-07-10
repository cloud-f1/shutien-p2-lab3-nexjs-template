---
name: new-project
description: >
  Bootstrap a fork of this template into a NEW product, step by step. Use when the user says
  "start a new project", "set this up as my product", "configure the template for <X>", or forks
  the repo. Pairs an INTERACTIVE terminal wizard (scripts/new-project.sh — the deterministic
  identity/config half) with the /athena:new-project command (the agent-judgment half: prose,
  domain SSOT swap, roles, screens). Teaches the keep-vs-replace boundary so a fork doesn't drift.
user-invocable: true
---

# New Project — fork → product, step by step

Turning this template into a product has a **deterministic half** (identity find/replace, prune
unused skills) and a **judgment half** (rewriting prose, swapping the domain SSOT, designing
schema/roles/screens). This skill runs the first with an interactive wizard and hands the second
to the agent — so a fork is configured in minutes without the drift that forks of this template
have experienced (wrong repo URLs, stale CLAUDE.md, leftover template skills). Read
[`docs/TEMPLATE-VS-PRODUCT.md`](../../../docs/TEMPLATE-VS-PRODUCT.md) first — the keep/replace map.

## Step 1 — Run the interactive wizard (deterministic)

```bash
scripts/new-project.sh            # dry-run: prompts + previews the plan, changes nothing
scripts/new-project.sh --apply    # prompts, one confirm, then applies
```

It auto-detects the *current* identity (product name from `next-app/lib/branding.ts` `APP_NAME`,
repo slug from `git remote`, docs domain from `dev-docs/.vitepress/config.mts`) and prompts for
the new values with those as defaults.

On `--apply` it makes ONLY the safe, scoped edits:
- `next-app/lib/branding.ts` `APP_NAME` default → your product name
- the **repo slug** (the most-missed string — CI badge, clone lines, `socialLinks`, `editLink`)
  and the **docs domain** across `README.md` + `dev-docs/.vitepress/config.mts` + `dev-docs/index.md`
- removes the template-only skills you selected (billing/landing/`module-author`/`spec-first`…)

It ends with a brand-staleness grep (audit Step 6b) + the agent next-steps. **Always dry-run first.**

## Step 2 — Hand the judgment half to the agent

Run **`/athena:new-project "Your Product"`** (the command). It does what a script shouldn't:
- rewrite CLAUDE.md "What This Project Is" + "Current State" and the README intro to your product
- swap the domain SSOT + product PRD to yours (cross-link `docs/PRD.md` as the *substrate* PRD —
  don't delete it; the two PRDs are intentional)
- reset roles + permission flags (`next-app/lib/permissions.ts`) + `next-app/drizzle/seed.ts` demo
  accounts (admin@example.com → your demo accounts), and update the doc↔code contract test if present

## Step 3 — Reset epics, verify, ship green

```bash
make new-project                     # archive template epics → start from E1
/athena:audit                        # confirm zero brand/identity/doc↔code drift (Step 6)
bash scripts/pre-merge-check.sh && (cd dev-docs && pnpm build)   # hand the fork a green tree
/athena:plan                         # design your first real feature
```

## What this is NOT

Not a code generator for your domain — schema, screens, and rules are `/athena:plan` →
`/athena:flow` work. This only removes the *template's* identity and substrate so you start clean.

## Pairs with

`rebrand` (the identity mechanics this reuses) · `alignment-audit` + `/athena:audit` (drift checks) ·
`docs/TEMPLATE-VS-PRODUCT.md` (keep/replace) · `make new-project` (epic reset).

## Safety

Wizard is dry-run by default; every `--apply` edit is a scoped find/replace behind one confirm.
Run it on a branch, review the diff, then commit — never straight to `main`.
