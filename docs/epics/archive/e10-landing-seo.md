# E10 — Landing + SEO

> **Size**: M (1-2 sessions) | **Depends on**: E1 (Theme System)
> **Status**: spec

---

## Overview

Complete SEO foundation: robots.txt, sitemap.xml, theme preview section on landing page, and ensure all routes have proper `<Seo>` meta tags. Landing page and Seo component already exist — this epic fills remaining gaps.

## No OpenAPI Changes

This epic is client-only. No new API endpoints.

## What Already Exists
- `LandingPage.tsx` — full marketing page with 6 sections
- `Seo.tsx` — per-route meta/title/canonical/OG component
- `index.html` — base SEO (favicon chain, OG defaults)
- `ThemeProvider.tsx` — 4 themes (dark/indigo/navy/sage) + system
- All auth/legal/dashboard pages exist

## Changes Needed

### 1. robots.txt (`client/public/robots.txt`)
```
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /verify-email
Disallow: /reset-password

Sitemap: https://claude-agent-template.zeabur.app/sitemap.xml
```

### 2. Sitemap (`client/public/sitemap.xml`)
Static sitemap for public routes:
- `/` (landing)
- `/signin`
- `/signup`
- `/privacy`
- `/terms`

### 3. Theme Preview Section on Landing
Add a new section between "Features" and "Structure" sections showing:
- 4 theme cards (dark, indigo, navy, sage) with color swatches
- Click to preview — applies `data-theme` temporarily
- "Try it live" interaction using ThemeProvider's `setTheme()`

### 4. Seo Component on All Routes
Verify every route in App.tsx renders `<Seo>`:
- `/signin`, `/signup` — auth pages
- `/forgot-password`, `/reset-password`, `/verify-email` — auth flows
- `/dashboard` — protected (noindex via robots.txt)
- `/privacy`, `/terms` — legal pages
- `*` (404) — not found page

### 5. Structured Data (JSON-LD)
Add Organization schema to landing page for rich search results.

## Test Stories

### Client
1. robots.txt — accessible at `/robots.txt`, contains Disallow rules
2. sitemap.xml — accessible at `/sitemap.xml`, valid XML
3. Theme preview section renders 4 theme cards
4. Clicking theme card changes active theme
5. All public routes have `<Seo>` component
6. NotFoundPage has `<Seo>` with appropriate title

## Files Changed
- `client/public/robots.txt` — new
- `client/public/sitemap.xml` — new
- `client/src/pages/LandingPage.tsx` — add theme preview section
- `client/src/pages/LandingPage.css` — theme preview styles
- Various pages — add `<Seo>` where missing
