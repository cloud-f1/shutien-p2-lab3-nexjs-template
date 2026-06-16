# E284 — Fix the @saas install footguns (fork-ability)

> Phase 67 (Fork-ability) · registry · branch `feat/E284-saas-install`
> Source: the 2026-06 fork-readiness audit (F12, F13, F14) — the headline fork blockers.

## Problem

The `@saas` registry (the template's marquee "installable modules" feature) had three P0 footguns:
- **F14** — `install-landing` told you to `rm -f app/page.tsx` calling it a "placeholder", but in this
  template that IS the real composed landing → following the skill deletes the homepage + causes a route collision.
- **F12** — the registry URL was hardcoded to `http://localhost:3000` (components.json, .mcp.json, registry.json),
  so `npx shadcn add @saas/x` only worked while the forker's own dev server ran, and silently broke after deploy.
- **F13** — landing + billing were double-shipped (baked-in AND in the registry) and the registry copies had
  **drifted older** → installing overwrote newer baked-in code with stale code.

## Solution

- **F14** — Rewrote `install-landing` (SKILL + manifest `postInstall`): the description no longer calls
  `app/page.tsx` a placeholder; Phase 2 is now a **guarded** archive that only replaces `app/page.tsx` if it
  contains the create-next-app marker (`Get started by editing`) and otherwise STOPS. A "READ FIRST" banner
  states the landing is pre-installed in this template — do nothing here (the skill targets *other* projects).
- **F12** — Registry URL is env-driven. Verified against the installed **shadcn 4.11.0** (expands `${VAR}` in
  `components.json` registry URLs via `/\${(\w+)}/g`, loaded from `.env*`; throws a clear error if unset; does
  NOT support `${VAR:-default}`). `components.json` → `"${SAAS_REGISTRY_URL}/r"`; `.mcp.json` REGISTRY_URL →
  `"${SAAS_REGISTRY_URL:-http://localhost:3000}/r"` (MCP loader supports `:-`); `registry.json` homepage → repo URL.
  `SAAS_REGISTRY_URL` documented in `.env.example` (default `http://localhost:3000`, "run `pnpm dev` for local
  installs / set to your domain for a hosted registry").
- **F13** — Chose the **safe path (warnings, not resync)**: a mechanical live→registry copy would ship *broken
  standalone installs* (the live `lib/billing/*` + landing now depend on template-only files the modules' `files[]`
  don't ship — period/reconcile utils, permissions/audit, marketing sub-components). Added prominent
  "READ FIRST" drift/overwrite banners to `install-stripe-billing` + `install-ecpay-billing` (+ landing), and a
  "How the registry is served" + "pre-installed modules drift" section to `module-author`.

## Acceptance Criteria

- [x] `install-landing` cannot delete this template's real homepage (guarded on the create-next-app marker).
- [x] Registry URL is env-driven + documented (`SAAS_REGISTRY_URL`).
- [x] Install skills warn that re-installing overwrites newer baked-in copies.
- [x] `pnpm registry:build` + `pnpm module:validate` (3 manifests) + `pnpm typecheck` all green.

## Out of Scope

- A true live↔registry resync (would require restructuring each module's `files[]` to be self-contained) — flagged
  for a dedicated module-hardening pass.
