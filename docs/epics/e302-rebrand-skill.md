# E302 — Rebrand Skill + Logo Mark Pipeline + Dev-docs Guide

> Phase 71 · fork-ability · toolchain enrichment
> Status: ⬜ pending

## Problem

`next-app/lib/branding.ts` and `NEXT_PUBLIC_APP_NAME` exist (E285), but:

1. **No rebrand skill** — there is no `.claude/skills/rebrand/SKILL.md` to guide a fork through the full rebrand process (logo mark → 5 rendered formats, dev-docs config + content sweep, live vs history distinction). Every fork author re-discovers the same pitfalls: hitting stale `.next/` artifacts in grep, not knowing about `apple-icon.png` + `favicon.ico`, not knowing which docs to rewrite vs leave.
2. **No single SVG mark → 4 renders pipeline** — `components/logo.tsx` exists, but there is no documented pipeline for how to generate `app/icon.svg` → `apple-icon.png` → `favicon.ico` → `dev-docs/public/logo.svg` from one geometry.
3. **Dev-docs identity is template-branded** — after a fork, `dev-docs/.vitepress/config.mts` + `index.md` still say "@saas Template" and point at the upstream repo's GitHub/socialLinks/editLink.
4. **No "live vs history" rule** — forks don't know they should rewrite `README.md`/`CLAUDE.md`/`index.md` (live identity) but leave `docs/epics/**`/`docs/releases/**`/`docs/context/**` intact (append-only history).

## Solution

1. **`.claude/skills/rebrand/SKILL.md`** — full rebrand skill documenting:
   - The single knob (`branding.ts` → `APP_NAME` / env var)
   - SVG mark → 5 renders (logo.tsx / icon.svg / apple-icon.png / favicon.ico / dev-docs/public/logo.svg)
   - Dev-docs config + hero + content sweep + repo URL repoint
   - Live identity vs append-only history rule
   - Source-only grep verification (exclude `.next/`, `epics/`, `releases/`, `context/`)
   - Redeploy via `gh-cf-deploy` + verify checklist

2. **`next-app/lib/branding.ts` annotation** — add a comment pointing fork authors to the `rebrand` skill

3. **`docs/guides/rebrand.md`** — prose guide for fork teams (links to skill, explains the concept)

4. **Dev-docs VitePress pattern** — document in skill: `themeConfig.socialLinks` + `editLink.pattern` repoint; `head` favicon; `srcExclude` for engineer-only pages; `_redirects` for Cloudflare edge cache

## Key Files

- `.claude/skills/rebrand/SKILL.md` (NEW) — complete rebrand skill
- `next-app/lib/branding.ts` — add fork guidance comment
- `docs/guides/rebrand.md` (NEW) — prose guide for fork teams
- `dev-docs/.vitepress/config.mts` — add `srcExclude` + `_redirects` note (or create the file)
- `dev-docs/public/_redirects` (NEW) — Cloudflare edge cache redirect rule

## Implementation

### Phase 1 — Rebrand skill
- Copy the `rebrand/SKILL.md` from the pm project reference
- Adapt to this template's context (logo.tsx component name, actual file paths, "AI App Template" default name)
- Verify all file paths referenced in the skill are accurate for this codebase

### Phase 2 — Dev-docs VitePress hardening
- Add `dev-docs/public/_redirects` with Cloudflare Pages redirect rules (removed paths → /docs/)
- Update `dev-docs/.vitepress/config.mts` to note `srcExclude` pattern for fork teams
- Add fork-customization note in `dev-docs/index.md` front-matter comments

### Phase 3 — Fork guide
- Write `docs/guides/rebrand.md` — concise prose version of the skill checklist
- Link from `docs/zh-tw/getting-started.md` Step 4

## Acceptance Criteria

- [ ] `.claude/skills/rebrand/SKILL.md` exists and covers: single knob · SVG pipeline · dev-docs · live vs history · grep verify · redeploy
- [ ] `dev-docs/public/_redirects` exists (Cloudflare edge cache redirect rule)
- [ ] `docs/guides/rebrand.md` exists and links to the skill
- [ ] `pnpm build` in `dev-docs/` still passes
- [ ] No regressions to existing tests

## Out of Scope

- Automating the logo SVG generation (manual design step)
- Renaming the `@saas` registry namespace (infrastructure-level, not branding)
- Implementing the rebrand for this repo (the template stays "AI App Template")
