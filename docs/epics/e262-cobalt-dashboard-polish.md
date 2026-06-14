# E262 — Cobalt Dashboard Polish

**Phase:** 60 | **Status:** ⬜ | **Depends:** E259

## Problem

The existing `(dashboard)` shell (shadcn blocks) is solid but plain next to the Cobalt app shell. We want to adopt Cobalt's premium touches selectively — without breaking RBAC, i18n, or the e2e suite.

## Solution

Apply Cobalt's component treatments to the existing dashboard: KPI brand-wash cards, semantic badges/status dots, premium inputs/segmented controls, and (optionally) a ⌘K command palette.

## Key Files

- `next-app/components/` (section cards / KPI, data table, dashboard widgets)
- `next-app/components/ui/badge.tsx` (add success/warning/info variants) + status-dot helper
- `next-app/app/(dashboard)/**` (apply treatments)
- (ref: `/tmp/cobalt-design/ai-app/project/cobalt/app/page-dashboard.jsx`, `shell.jsx`, `components.jsx`)

## Implementation

1. KPI cards: brand-wash gradient (`.kpi`, light only) + tabular-nums values + trend deltas.
2. Badges: add `success`/`warning`/`info` variants (E259 colors) + a status-dot component; use for roles/states.
3. Premium inputs/segmented/switch treatments where shadcn equivalents are used.
4. *(Optional)* ⌘K command palette (shadcn `command` + dialog) for nav.
5. Verify RBAC nav, i18n strings, and all e2e selectors still pass (don't rename test-critical hooks).

## Acceptance Criteria

- [ ] KPI cards show the brand wash (light) + clean dark; semantic badges/dots in use.
- [ ] No regression: 3-tier RBAC nav + i18n intact; **`pnpm test:e2e` still green**.
- [ ] `pnpm build` + lint + typecheck green.

## Out of Scope

- Cobalt-specific product pages (workflows/team/system/billing) — deferred. Full shell rewrite — selective polish only.
