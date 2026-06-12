# E168 — Public Surface Migration to Unified Design System

> Phase 43 — Universal Design System Adoption | Size: M (5 SP) | Deps: E167

## Problem

Five public-facing pages still own their own CSS files and hand-tuned layouts:

| Page | Current state |
|---|---|
| `LandingPage.tsx` | `LandingPage.css` — hero, feature grid, theme-card preview, footer |
| `GettingStartedPage.tsx` | `GettingStarted.css` — bilingual onboarding flow |
| `PrivacyPage.tsx` | `Legal.css` — long-form prose |
| `TermsPage.tsx` | `Legal.css` (shared) — long-form prose |
| `NotFoundPage.tsx` | inline styles — minimal 404 |

Two consequences:
1. **The Preset/theme swap stops at `/dashboard/*`.** A fork that wants a different brand has to fork five page CSS files in addition to swapping the preset.
2. **No primitives for marketing/static surfaces.** A new public route (e.g. pricing, changelog) starts from scratch every time.

## Solution

Add public-surface primitives, then migrate the five pages to compose them.

### Public-surface primitives (new in `components/ui/`)

| Primitive | Purpose |
|---|---|
| `<PublicLayout>` | Outer shell: skip-nav, top `<NavBar>`, `<main>`, `<Footer>`. Used by every public page. |
| `<NavBar>` | Public top nav (logo + links + Sign In / Sign Up CTAs). Distinct from `DashboardLayout`'s sidebar. |
| `<Footer>` | Site footer (brand + nav links + small print). Currently fragmented across `globals.css`. |
| `<HeroSection>` | Big-title + subtitle + CTA cluster + optional visual slot |
| `<FeatureGrid>` | Responsive grid of `<FeatureCard>` (icon + title + description) |
| `<Section>` | Content section with title + lede + body slot. Used for "How it works", "Stack", "Theme preview", etc. |
| `<CTABanner>` | Bottom-of-page "Ready to start?" call-to-action band |
| `<Prose>` | Long-form text wrapper with explicit type-scale (used by Privacy/Terms) |
| `<EmptyState>` | Centered illustration + title + subtitle + optional CTA. Used by 404 and any "no data" page. |

Each primitive lives in `components/ui/`, gets a Preset slot in `preset.ts`, has co-located tests, and is documented in `design.md` § 4.

### Page migrations

| Page | Composition |
|---|---|
| `LandingPage` | `<PublicLayout><HeroSection /><FeatureGrid /><Section /> (× n) <CTABanner /></PublicLayout>` |
| `GettingStartedPage` | `<PublicLayout><Section /> (× n)</PublicLayout>` |
| `PrivacyPage` | `<PublicLayout><Prose>{markdown-like content}</Prose></PublicLayout>` |
| `TermsPage` | Same as Privacy. |
| `NotFoundPage` | `<PublicLayout><EmptyState title="Not Found" subtitle="…" cta={<Link to="/">Back home</Link>} /></PublicLayout>` |

The `THEME_CARDS` interactive preview on `LandingPage` stays — it's the marketing demo of the theme axis. But it now renders inside a `<Section>` like any other landing block.

## Key Files

| File | Action |
|---|---|
| `client/src/components/ui/{PublicLayout,NavBar,Footer,HeroSection,FeatureGrid,FeatureCard,Section,CTABanner,Prose,EmptyState}.tsx` | New — 10 primitives |
| `client/src/components/ui/preset.ts` | Edit — add 9 new Preset slots (one per primitive); update `defaultPreset` + `compactPreset` |
| `client/src/components/ui/index.ts` | Edit — barrel-export new primitives |
| `client/src/components/ui/__tests__/*.test.tsx` | New — co-located test per primitive |
| `client/src/pages/{LandingPage,NotFoundPage}.tsx` | Rewrite — compose primitives |
| `client/src/pages/getting-started/GettingStartedPage.tsx` | Rewrite — compose primitives |
| `client/src/pages/legal/{PrivacyPage,TermsPage}.tsx` | Rewrite — compose primitives |
| `docs/design/design.md` | Edit — add public-surface primitives to § 4, new "Marketing page recipe" in § 5, update § 7 migration status |

## Implementation

1. Author the 10 primitives (parallel-safe — each is independent). Tests + Preset slots required for each.
2. Migrate `NotFoundPage` first (simplest, lowest risk) to validate the public chrome.
3. Migrate `PrivacyPage` + `TermsPage` next (both use `<Prose>` — second-easiest).
4. Migrate `GettingStartedPage` (uses `<Section>` repeatedly).
5. Migrate `LandingPage` last (most complex; uses every primitive).
6. After each migration, grep for orphan CSS classes; only delete the page's CSS file once grep is empty.
7. Update `design.md` § 7 migration table.

## Acceptance Criteria

- [ ] All 10 public-surface primitives shipped with tests + Preset slots
- [ ] All 5 public pages migrated; each renders structurally identical to the pre-migration version (manual visual check across 6 themes)
- [ ] `LandingPage.css`, `Legal.css`, `GettingStarted.css` all deleted (deferred to E170 if any consumer is hard to reach)
- [ ] `design.md` § 4 lists all new primitives with prop tables
- [ ] `design.md` § 7 migration status table updated — public surfaces all ✅
- [ ] Bundle-size budget: CSS ≤ 75 kB gzipped (we're at 65 kB after E167; this epic should not exceed +10 kB)
- [ ] All client tests pass; build green
- [ ] Stop-verifier Rule #17 (CSS-var drift) reports no new undefined references

## Alignment / Cross-Epic Hooks

- **Hard-depends on E167** — uses `Preset` axis, Tailwind utilities, and the `getActivePreset()` indirection.
- **Pairs with E169** (auth migration) — together they complete the "every page is on primitives" promise.
- **Enables E170** (legacy CSS deletion) — `LandingPage.css`, `Legal.css`, `GettingStarted.css` become deletable once this epic ships.
- **Updates `@designer` agent prompt** (E163) to reference the new public-surface primitives so generated pages use them.

## Out of Scope

- **Auth pages** — owned by E169.
- **Pricing / changelog / docs-site pages** — those don't exist yet; build them with the new primitives when needed.
- **CMS / MDX rendering for legal pages** — `<Prose>` wraps existing JSX; replacing the JSX content with MDX is a separate concern.
- **A/B testing infrastructure** for the landing page — out of scope.
- **Theme preview component refactor** — `THEME_CARDS` array stays as-is; only its container changes to `<Section>`.
