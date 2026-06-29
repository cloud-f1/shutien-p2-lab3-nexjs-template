---
description: "(planning) Fork bootstrap → turn this template into a NEW product: rebrand → swap SSOT/PRD → prune → reseed → refresh identity → audit → green CI."
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# /athena:new-project — Template → new product bootstrap

Turn a fresh fork of this template into *your* product in one guided pass, instead of the
ad-hoc, drift-prone way (which leaves upstream repo URLs, a stale CLAUDE.md, and template
skills lying around). This **orchestrates existing skills**; it doesn't reinvent them.
Read `docs/TEMPLATE-VS-PRODUCT.md` first — it's the keep/replace map.

`$ARGUMENTS`: an optional product name (e.g. `/athena:new-project "Acme Ops"`). If absent, ask.

## Confirm before mutating

This rewrites identity files and prunes skills. Summarize the plan (product name, repo slug,
docs domain, which template skills to prune) and get a yes before editing. Work on a branch.

> **Deterministic half = the interactive wizard.** Steps 1–2 + the skill-prune are exactly what
> `scripts/new-project.sh` does (dry-run by default, `--apply` to execute). Offer to run it for the
> user (or run it yourself non-interactively from the gathered inputs); then this command does the
> judgment half (Steps 3+). See the `new-project` skill.

## Steps (each step = one existing tool; stop on failure)

1. **Gather identity.** Product name, the new repo slug (`<org>/<repo>` — from `git remote get-url origin`), docs domain (if any), and the path to the product's domain SSOT + PRD. These are the inputs `scripts/new-project.sh` consumes.

2. **Rebrand** — invoke the **`rebrand` skill**: `branding.ts` `APP_NAME`, logo/favicon, README (title/badges/**repo URLs**/demo logins), CLAUDE.md header + "Current State", dev-docs `config.mts` (title + **`socialLinks`/`editLink` repo URLs**), `index.md` hero. The most-missed strings are the *repo slug* and *docs domain*, not the product name — grep for all three.

3. **Swap the domain SSOT + PRD.** Point the product PRD at yours (keep `docs/PRD.md` as the *substrate* PRD — see the boundary doc). Cross-link them so neither looks authoritative-for-the-other.

4. **Prune template-only skills** (per `docs/TEMPLATE-VS-PRODUCT.md` § Prune): remove the billing/landing/`module-author`/`openapi-first` skills your product doesn't use; trim their rows from any reference docs.

5. **Reset roles + seed identity.**
   - In `next-app/lib/permissions.ts`: replace the role enum values (`admin`, `editor`, `viewer`) with your product's roles. Keep the *mechanism* (guards re-reading role from DB) — only replace the *names* and *flag set*.
   - In `next-app/drizzle/seed.ts`: replace the demo accounts (`admin@example.com / Admin123!`, `editor@example.com / Editor123!`, `viewer@example.com / Viewer123!`) with your product's demo credentials.

6. **Reset epics** — `make new-project` (archives the template epics to `docs/epics/archive/template-phases/`, starts from E1; preserves history). Then `/athena:plan` your first feature.

7. **Audit for leftovers** — run `/athena:audit` (esp. **Step 6b brand/identity staleness**): grep the live identity set for the OLD repo slug, OLD docs domain, and any pre-rebrand product name. Zero hits is the gate.

8. **Verify green.** `bash scripts/pre-merge-check.sh` (typecheck · lint · unit) + `cd dev-docs && pnpm build`. A template must hand the fork a green tree.

## Output

A checklist of what changed + the audit result + any TODOs the human must finish (real domain
logic, screens — those are `/athena:plan` work, not bootstrap). Do NOT merge — leave the PR for review.

## Rules

- NEVER skip Step 7 (audit) — silent identity drift is the #1 fork failure.
- Keep substrate (athena pipeline, registry, CI, deploy) intact; only replace product layers.
- One branch, one PR; report, don't merge.
