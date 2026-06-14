# E247 — Registry Infrastructure

**Phase:** 58 | **Status:** ⬜ | **Depends:** none

## Problem

`components.json` has an empty `registries: {}`. There is no way to publish or install
feature modules. We need the substrate that turns this template into a shadcn-style
registry so the Landing / Account / Admin / Billing modules can be distributed and
installed via `npx shadcn add`. This is Wave 0 foundation — everything else rides on it.

## Solution

- `registry.json` (catalog: name, homepage, `items[]`) at the `next-app/` root.
- `pnpm registry:build` script → `shadcn build` emits `public/r/*.json` (one registry-item
  per module). shadcn CLI is already `^4.11.0`.
- Wire `components.json > registries` with a self namespace `@saas` →
  `http://localhost:3000/r/{name}.json` (prod URL via env).
- A trivial `hello-module` registry item (one component + one lib file) to prove the loop:
  `npx shadcn add @saas/hello-module` copies files into a throwaway path.
- Document the publish flow (build → served from `next-app/public/r/` or a static host).

## Acceptance

- [ ] `pnpm registry:build` produces schema-valid `public/r/*.json` items
- [ ] `components.json registries` has a working `@saas` namespace
- [ ] `npx shadcn add @saas/hello-module` installs the smoke item end-to-end (verified locally)
- [ ] registry build is reproducible (no uncommitted drift in pre-merge)

## Research-Informed Refinements (2nd pass · `woawzys1o`)

- shadcn registry is **static file distribution** — the item `type` enum has no `script`/`migration`,
  `envVars` only writes `.env` (no code execution), and there is **no lifecycle hook / post-install**
  (verified). So a registry install cannot trigger a Drizzle migration; the `install-*` skill +
  Drizzle Kit do that (see E248/E252).
- **Uninstall is not automated by any tool** (verified: Kirimase et al. are one-way scaffolding, no
  remove/rollback). Scope "拆卸" realistically: ship a **manifest-driven manual uninstall checklist**
  (derived from each module's `files` + `dbTables` + `envVars`), not an automated reversible uninstall.
