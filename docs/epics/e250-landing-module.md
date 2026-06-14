# E250 — Landing Module

**Phase:** 58 | **Status:** ⬜ | **Depends:** E247, E248

## Problem

The homepage is a placeholder; there is no marketing surface. Landing is also the
lowest-risk module (zero cross-module deps), making it the end-to-end proof that the
registry + manifest + install-skill mechanism actually works.

## Solution

- `(marketing)` route group + `layout.tsx` (public nav + footer, theme-aware); `/` → landing.
- Sections from shadcn blocks: Hero, Features, Pricing (wired to E249 `plans` later), FAQ,
  CTA — as `components/marketing/*`.
- Package as the `@saas/landing` registry module: `registry:page` (route) +
  `registry:component` (sections) + `module.manifest.json` (envVars: minimal; dbTables: none;
  registryDependencies: shadcn ui primitives).
- `install-landing` consumer skill (shipped via universal `registry:file`): customization
  steps (copy/branding); no DB migration.

## Acceptance

- [ ] `/` renders a real landing page (hero/features/pricing/FAQ/CTA), theme-aware, responsive
- [ ] packaged as `@saas/landing`; `npx shadcn add @saas/landing` installs into a clean Next app
- [ ] `module.manifest.json` + `install-landing` skill ship with the module
- [ ] e2e smoke: landing renders; pricing CTAs route correctly
- [ ] contributes a docs page + iframe live-demo + API-demonstration entry to the E240 VitePress site (via manifest `docs`/`demo`)

## Research-Informed Refinements (2nd pass · `woawzys1o`)

- **Route-group skeleton: follow the existing in-repo precedent** — the codebase already ships
  `app/(auth)/` and `app/(dashboard)/` route groups with per-group `layout.tsx` (public-card vs
  sidebar+auth-gate). This epic adds a sibling `app/(marketing)/` group (public nav + footer) the
  same way. The 2nd research pass found **no external verified evidence** on boilerplate route-group
  layering (a known gap), so anchor on the working local pattern rather than importing an unverified
  external skeleton. Account & Admin modules were deferred from this graft (re-derive against the i18n dashboard structure later).
