# E305 — User Guide Builder Skill + VitePress Deploy Pattern

> Phase 71 · toolchain enrichment · documentation
> Status: ⬜ pending

## Problem

Fork teams that build a product on this template need to publish an end-user manual. There is no guidance on:
1. How to split engineer-facing vs user-facing content in the VitePress site
2. How to take logged-in screenshots of the running app to ground the manual
3. How to write domain-accurate, per-item documentation (every button/field/chip explained)
4. How to handle Cloudflare Pages edge-cache staleness when removing pages
5. How to verify cross-page `#fragment` anchors (VitePress validates page links but NOT fragment anchors)

The `dev-docs/` VitePress site currently serves as an engineer/template reference. The skill + guide teaches how to transform it (or add to it) as a user-facing manual.

## Solution

1. **`.claude/skills/user-guide-builder/SKILL.md`** — complete skill covering:
   - Audience audit first (srcExclude engineer docs; add `_redirects`)
   - Boot the real app + seed (Playwright prerequisite)
   - Playwright logged-in tour via `tour-app.cjs` → per-item screenshots
   - Mine epics → one shared domain digest (single source for all page writers)
   - Grounded per-page writers (one agent per page, in parallel; house-style block)
   - Concepts page owns stable H2 anchors; verify `page#anchor` cross-links by hand
   - Build + redeploy via `gh-cf-deploy` + verify on fresh deployment hash URL

2. **`dev-docs/public/_redirects`** — Cloudflare Pages redirect rule for removed paths → guide (prevents 404 on edge-cached stale paths; pairs with E302)

3. **`dev-docs/.vitepress/config.mts` pattern** — document `srcExclude` for audience split; add a comment block explaining the fork audience-split pattern

4. **`docs/guides/dev-docs-guide.md`** — concise prose guide for fork teams: when to use user-guide-builder, how to publish, how to verify

## Key Files

- `.claude/skills/user-guide-builder/SKILL.md` (NEW) — complete user-guide-builder skill
- `dev-docs/public/_redirects` (NEW or update from E302) — Cloudflare redirect rules
- `dev-docs/.vitepress/config.mts` — add `srcExclude` comment + audience-split pattern
- `docs/guides/dev-docs-guide.md` (NEW) — prose guide for fork teams
- `scripts/mockup/tour-app.cjs` — referenced by this skill (created in E303)

## Implementation

### Phase 1 — Skill
- Port `user-guide-builder/SKILL.md` from pm reference
- Adapt to this template (login is via email+password, not badge; default logins documented)
- Include the house-style block for 繁中 per-item writers
- Include the VitePress `srcExclude` + `_redirects` audience-split section
- Include cross-page anchor verification technique (VitePress fragment gotcha)

### Phase 2 — VitePress patterns
- Add `dev-docs/public/_redirects` if not already created by E302
- Add audience-split note to `dev-docs/.vitepress/config.mts` as a comment block
- Add a `srcExclude` example (commented out — don't activate it; template is engineer-facing by default)

### Phase 3 — Prose guide
- Write `docs/guides/dev-docs-guide.md` — concise guide for fork teams
- Link from `docs/zh-tw/getting-started.md`

## Acceptance Criteria

- [ ] `.claude/skills/user-guide-builder/SKILL.md` exists and covers all 7 steps
- [ ] `dev-docs/public/_redirects` exists with at least a comment explaining the pattern
- [ ] `docs/guides/dev-docs-guide.md` exists and links to the skill
- [ ] `dev-docs/.vitepress/config.mts` has the audience-split comment block
- [ ] `cd dev-docs && pnpm build` passes

## Out of Scope

- Actually writing a user guide for the template (template is developer-facing, not end-user)
- Implementing the Playwright tour script (done in E303)
- Cloudflare Pages deployment (covered by `gh-cf-deploy` skill)
