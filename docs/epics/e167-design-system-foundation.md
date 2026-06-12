# E167 — Unified Design System Foundation (Tailwind + Primitives + Preset axis)

> Phase 43 — Universal Design System Adoption | Size: L (8 SP) | Deps: none
> Source: PR #142 (`claude/unified-design-system-VOoGK`) — landed during session 2026-05-02
> Status: ✅ Implementation + QA done in-flight; this spec is **retrospective** documentation so the work is captured in the epic chain.

## Problem

Until this epic, every page in the client owned its own CSS file (`AuthPages.css`, `Dashboard.css`, `LandingPage.css`, `Legal.css`, `SecuritySessionsView.css`, …) and hand-rolled its own header markup (`<div class="page-header"><div class="page-eyebrow">…</div><div class="page-title">…</div></div>`). There was no shared `<DataTable>`, no `<Pagination>`, no `<Breadcrumb>`, no `<FormField>`, and no way to swap the visual style without forking every component.

Three concrete pains:
1. **No table primitive** — `SecuritySessionsView` hand-rolled a `<table>` with bespoke CSS. Any new list view started from scratch.
2. **Theme axis only covered colors/fonts/radii** — there was no clean way to swap *layout density*, *button shapes*, or *separator glyphs* without editing every component.
3. **Tailwind not installed** — every styling decision required writing CSS in a co-located file.

## Solution

Three deliverables, all already shipped on the PR branch:

1. **Tailwind v3.4 + PostCSS**, configured with `corePlugins.preflight = false` so it coexists with the legacy reset. Every utility (`bg-surface`, `text-text-primary`, `border-border`, `font-display`, `rounded-lg`, `shadow-md`, …) maps to a `var(--token)` from `themes.css`. Theme switching still works end-to-end across all 6 themes.

2. **Eight shared primitives** in `client/src/components/ui/`, barrel-exported:

   | Primitive | Purpose |
   |---|---|
   | `<PageContainer>` | Unified page chrome — eyebrow + title + subtitle + breadcrumbs + actions slot |
   | `<Breadcrumb>` + `useBreadcrumbs()` | Route-derived breadcrumb from `routeMap.ts` |
   | `<DataTable>` | Search + filter + pagination + per-row CRUD actions + loading/error/empty states |
   | `<Pagination>` | Standalone pager (used inside DataTable + exportable for server-side queries) |
   | `<SearchInput>` | A11y-correct search box with default `aria-label` from placeholder |
   | `<FilterSelect>` | Toolbar dropdown filter |
   | `<FormField>` | Label + hint + error wrapper for any input, plugs into react-hook-form |
   | `<Button>` | Tailwind-native button with 4 variants × 3 sizes + loading state |

3. **`Preset` axis** — a second design-system axis orthogonal to themes. Every Tailwind class string, separator glyph, button-variant map, and density token lives in `client/src/components/ui/preset.ts`. Components read from `getActivePreset()` — there are zero hardcoded class strings in any primitive. Two presets ship: `defaultPreset` and `compactPreset`. Swap with `setActivePreset(myPreset)` at app boot.

## Key Files

| File | Action | Status |
|---|---|---|
| `client/package.json`, `client/postcss.config.js`, `client/tailwind.config.ts` | New — Tailwind v3.4 install + bridge to CSS vars | ✅ |
| `client/src/styles/globals.css` | Edit — `@tailwind` directives | ✅ |
| `client/src/components/ui/preset.ts` | New — Preset interface + `defaultPreset` + `compactPreset` + swap helpers | ✅ |
| `client/src/components/ui/{Button,Breadcrumb,DataTable,FilterSelect,FormField,PageContainer,Pagination,SearchInput}.tsx` | New — 8 primitives, all preset-driven | ✅ |
| `client/src/components/ui/useBreadcrumbs.ts` | New — route-derived breadcrumb hook | ✅ |
| `client/src/components/ui/index.ts` | New — barrel export | ✅ |
| `client/src/components/ui/__tests__/*.test.tsx` | New — 9 test files / 51 tests covering all primitives + preset swap | ✅ |
| `client/src/pages/dashboard/views/*.tsx` (×9) | Edit — every dashboard view migrated to `<PageContainer>` | ✅ |
| `client/src/pages/dashboard/views/SecuritySessionsView.css` | Delete — orphan after primitive migration | ✅ |
| `client/src/components/dashboard/PageHeader.tsx` | Delete — dead legacy component, zero consumers | ✅ |
| `docs/design/design.md` | New — 561 lines: token map, primitive APIs, page recipes, preset swap, change-process | ✅ |

## Implementation Highlights

- **Tailwind ↔ CSS-variable bridge**: `tailwind.config.ts` defines `colors.primary = "var(--primary)"` etc. Utilities resolve to the live CSS var, so `<html data-theme="rose">` swaps every utility's resolved color in one paint.
- **Preset audit**: a grep gate in the change-process checklist (`design.md` § 10) fails the merge if any primitive grows a hardcoded Tailwind class string outside `preset.ts`.
- **A11y-first**: `<Breadcrumb>` uses `<nav aria-label="Breadcrumb">` + `aria-current="page"`. `<DataTable>` row actions accept `ariaLabel` for screen-reader context. `<SearchInput>` defaults `aria-label` to placeholder.
- **No bundle bloat**: CSS bundle 50 → 65 kB (+12 kB gzip). Tailwind dedupes shared utilities used by both presets.

## Acceptance Criteria

- [x] Tailwind installed + bridged to all 6 themes; `<html data-theme="…">` still swaps the entire UI
- [x] Eight primitives shipped with full TypeScript types, barrel-exported via `components/ui/index.ts`
- [x] Preset axis fully isolated — zero hardcoded Tailwind class strings in any primitive
- [x] All 9 dashboard views migrated to `<PageContainer>`
- [x] `SecuritySessionsView` rebuilt on `<PageContainer>` + `<DataTable>` end-to-end
- [x] 338/338 client tests pass; `pnpm build` green
- [x] `docs/design/design.md` documents architecture, primitive APIs, page recipes, preset swap, and change process
- [x] Stop-verifier clean (no new CSS-var drift, no localStorage, no `fireEvent`)

## Alignment / Cross-Epic Hooks

- **Foundation for E168, E169, E170, E171** (Phase 43). Without E167's primitives + Preset axis, those migrations have nothing to migrate *to*.
- **Complements E165** (rose + forest themes) — Tailwind utilities resolve to the same `--primary`/`--surface` vars those themes redefine.
- **Complements E163** (`@designer` + `/athena:design`) — generated pages should compose `<PageContainer>` + `<DataTable>` instead of bespoke CSS. Update the `@designer` agent prompt as part of E170.
- **Reads from**: `client/src/styles/themes.css`, `client/src/config/routeMap.ts`.
- **Writes to**: `client/src/components/ui/`, `client/src/pages/dashboard/views/`, `docs/design/design.md`, `client/tailwind.config.ts`.

## Out of Scope

- Migrating auth / landing / legal / 404 surfaces — owned by E168/E169.
- `<Modal>` / `<Drawer>` / `<Toast>` primitives — wait until 2+ pages need each.
- Server-side pagination — `<DataTable>` is currently client-side; add `pagination={{ controlled: true, … }}` when needed.
- Sortable columns — trivial extension; ship when needed.
- Visual regression test infrastructure — owned by E171.
