# E260 — Cobalt Premium FX Utilities

**Phase:** 60 | **Status:** ⬜ | **Depends:** E259

## Problem

The "premium" feel of the Cobalt design comes largely from restrained, eye-catching motion (aurora, shimmer headline, card lift, marquee, count-up). We have none of these as reusable utilities.

## Solution

Port the `§EYE-CATCHING FX` layer from Cobalt `components.css` into a dedicated, reduced-motion-safe CSS module + a small client hook for scroll-reveal and count-up.

## Key Files

- `next-app/app/cobalt-fx.css` (new) — imported from `globals.css` (or `app/layout.tsx`)
- `next-app/hooks/use-reveal.ts` (new) — IntersectionObserver-based reveal + count-up (client)
- `next-app/components/marketing/` — consumers (E261)

## Implementation

1. CSS layer: `.aurora`/`.aurora-blob` (drift keyframes), `.shimmer-text`, `.glow-cta`, `.shine`, `.lift`, `.marquee`/`.marquee-track`, `.live-dot`, `.float`, `.rise`, hero stagger (`.hero-in`/`.hero-dN`). Bind to E259 tokens (`--chart-*`, `--primary`, `--ease-*`, `--dur-*`).
2. `@media (prefers-reduced-motion: reduce)` block disabling animations + shimmer fallback to solid `--primary` (port verbatim).
3. `use-reveal.ts`: a hook that adds a visible class when an element scrolls into view + a count-up helper; SSR-safe (`"use client"`, guards `window`).

## Acceptance Criteria

- [ ] FX classes available app-wide; aurora/shimmer/lift/marquee render.
- [ ] `prefers-reduced-motion` disables motion + shimmer falls back to solid color.
- [ ] `use-reveal` hook is SSR-safe (no hydration mismatch, no `window` at import).
- [ ] `pnpm build` + lint green.

## Out of Scope

- Where they're used (E261/E262). Heavy JS animation libs — CSS + a tiny hook only.
