---
name: rebrand
description: >
  Rebrand this template into a specific product end-to-end: app name, logo, favicon,
  page titles, dev-docs (VitePress) identity + content, and a redeploy. Use whenever the
  user says "rebrand to <X>", "change the app name / logo / favicon", "replace the
  template branding", or drops a new product name/identity. Teaches the single-knob
  approach (one APP_NAME source of truth) + the deterministic SVG-mark→favicon pipeline
  + a "live docs vs append-only history" rule so you align what's current without
  rewriting the past. Pairs with gh-cf-deploy (the Cloudflare redeploy) and
  alignment-audit (verify nothing stale survived).
user-invocable: true
---

# Rebrand — template → product, end-to-end

A rebrand is *not* a global find-and-replace. The name lives in exactly one runtime knob;
the logo lives in one SVG mark rendered to five targets; the docs split into **live identity**
(rewrite) and **append-only history** (leave). Get those three boundaries right and the
rebrand is one small diff, not a sprawling sweep. (Real lesson from field use: a naïve
`grep -ri "AI App Template"` hits stale `.next/` build artifacts and historical epic
files — both false targets. Source-only, live-only is the discipline.)

## The single knob (do this first — it's most of the rebrand)

`next-app/lib/branding.ts` is the **one** source of truth for the product name + description.
It reads `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_DESCRIPTION` (baked at `next build`) and
falls back to a hardcoded default. To rebrand the running app:

```ts
// next-app/lib/branding.ts
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Your Product Name"
export const APP_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() ||
  "Your product description here."
```

`APP_NAME` drives the login logo wordmark, nav, footer, sidebar, and the document `<title>`
(via `app/layout.tsx` metadata). Changing this one default rebrands the whole app surface —
**never** hunt down hardcoded product names in components; if you find one, replace it with an
`import { APP_NAME } from "@/lib/branding"`, don't just retype the new name.

`NEXT_PUBLIC_*` vars are **baked at `next build`** — set them in Zeabur before the build
(or pass as build args in your Dockerfile `ARG`). Changing them at runtime has no effect until
a full redeploy.

## The logo mark (one SVG → five renders)

Design ONE mark as an SVG (a simple geometric glyph in the brand color reads at 16px). Then
render it everywhere from that single shape:

| Render | Path | How |
|---|---|---|
| In-app component | `next-app/components/logo.tsx` | theme-aware: `fill-primary` tile + `fill-primary-foreground` glyph (Tailwind tokens — **no inline `style=` color**, per the hook rule). Same geometry as the favicon. |
| Static favicon | `next-app/app/icon.svg` | literal `fill="#brand"` / `fill="#fff"` (static files can't use Tailwind tokens). |
| Apple touch icon | `next-app/app/apple-icon.png` (180×180) | `rsvg-convert -w 180 -h 180 logo.svg -o apple-icon.png` |
| favicon.ico | `next-app/app/favicon.ico` | `rsvg-convert -w 32 -h 32 logo.svg -o /tmp/f.png && sips -s format ico /tmp/f.png --out favicon.ico` |
| Docs hero/nav | `dev-docs/public/logo.svg` | a crisp larger-viewBox version of the same mark (note: `dev-docs/public/logo.svg` may not exist yet in a fresh fork — create it from your mark) |

`rsvg-convert` (librsvg) and `sips` (macOS) are the local tools used. If `rsvg-convert` is
absent: `brew install librsvg`. Keep the geometry **identical** across all five so the brand
is coherent at every size.

## Dev-docs (VitePress) — identity + content

Config lives at `dev-docs/.vitepress/config.mts`. After a fork, all of the following still
point at the upstream template — repoint them all:

1. **Config** — `dev-docs/.vitepress/config.mts`:
   - `title` + `themeConfig.siteTitle` → your product name
   - `head` favicon link (`{ rel:'icon', type:'image/svg+xml', href:'/logo.svg' }`)
   - `footer.copyright` → your product/org
   - `socialLinks` (GitHub icon) → your fork's repo URL
   - `editLink.pattern` ("Edit this page") → your fork's repo URL
   - Trim `nav` entries that no longer exist post-pivot

2. **Home hero** — `dev-docs/index.md` front-matter: `hero.name`, `hero.text`, `hero.tagline`,
   `hero.image.src: /logo.svg`, the `actions`, and the `features[]` cards — all to the product.

3. **Content sweep** — every page's prose. Use a subagent for breadth: "replace every
   `AI App Template` / template-heritage string with `<new-name>` across `dev-docs/**/*.md`,
   rewrite READMEs/getting-started/deployment/guides to the product, and DELETE pages describing
   features the product dropped." Verify with a **source-only** grep returning 0 (see below).

## Live docs vs append-only history (the alignment rule)

When the user says "align all the dev documents", split the targets:

- **Rewrite (live identity):** the **root `README.md`** (title, intro, badges, demo logins,
  deploy URLs — the repo's front page), `CLAUDE.md` (header + "What This Project Is" **and**
  its "Current State" block — auto-loaded every session, so a stale identity here misleads
  every future session), the top-level product PRD, and any "what is this" / getting-started
  prose. These describe the *current* product.
- **The most-missed strings are NOT the product name — they're the repo slug.** A grep for the
  old product name won't surface a wrong *repo URL*: CI/star badges, `socialLinks`, `editLink`,
  and `git clone` commands keep pointing at the upstream template. Grep separately for the old
  repo slug and the old docs domain (e.g. `*.pages.dev` domain from the original deploy).
- **Leave (append-only history):** `docs/epics/**` (incl. `archive/`/`_archive/`),
  `docs/releases/**`, `docs/context/**` logs. These are dated records of how the product got
  here — rewriting them falsifies history. Mention you skipped them and why.
- **Leave (real code features, not branding):** `@saas/*` registry references, `install-*`
  skills, `module-author` — these name an actual codebase mechanism, not the product. Only
  touch them if the pivot genuinely removed the feature.

When unsure whether a doc is "live identity" or "history", ask — don't silently rewrite.

## Redeploy the docs

After the docs content+config change, rebuild and redeploy via the **gh-cf-deploy** skill
(Cloudflare Pages, env-token — never `wrangler login`). Verify the production URL returns 200
and screenshot the hero to confirm the new name + logo rendered (not a stale cache).
If `gh-cf-deploy` is unavailable (fresh fork), deploy dev-docs via
`.github/workflows/deploy-dev-docs.yml` instead.

## Verify (source-only, live-only)

```bash
# 0 matches expected in SOURCE (exclude build artifacts + history)
grep -rniE "<old-name>" next-app docs dev-docs \
  --include="*.ts" --include="*.tsx" --include="*.md" --include="*.mts" \
  | grep -vE "\.next/|/dist/|\.vitepress/cache|/epics/|/archive/|/releases/|/context/|/superpowers/"
```

Then the standard gates: `cd next-app && pnpm typecheck && pnpm test` (tests that assert the
app name — e.g. `e2e/*.spec.ts` — must be updated to the new name in the SAME change, or they
go red), and `cd dev-docs && pnpm build`. Finally run the **alignment-audit** skill if you want
a structured "did anything stale survive" pass.

## Checklist

- [ ] `branding.ts` default(s) → product name + description
- [ ] No hardcoded product name in components (use `APP_NAME`)
- [ ] One SVG mark → `logo.tsx` + `icon.svg` + `apple-icon.png` + `favicon.ico` + `dev-docs/public/logo.svg`
- [ ] VitePress config (title/siteTitle/favicon/copyright/nav + repo URLs) + `index.md` hero
- [ ] Root `README.md` rewritten (title/intro/badges/demo logins/deploy URLs)
- [ ] Dev-docs content sweep (subagent) + dropped-feature pages deleted
- [ ] Live identity docs rewritten (incl. CLAUDE.md "Current State"); history left intact (reported)
- [ ] Tests asserting the old name updated in the same change
- [ ] typecheck + tests + docs build green
- [ ] Docs redeployed (gh-cf-deploy) + URL 200 + hero screenshot verified
- [ ] Grep returns 0 for BOTH the old product name AND the old repo slug / docs domain
