# E311 — Dev-Docs Integrity: Anchor-Check + Screenshot-Refresh + Smoke Gate

> Phase 73 · smoke testing + dev-docs guidance enrichment
> Status: ⬜ pending

## Problem

Two related gaps at the smoke ↔ dev-docs intersection:

1. **Cross-page `#fragment` anchors are unverified.** VitePress fails the build on dead *page* links but **not** on `page#anchor` fragments — a `concepts#wrong-anchor` builds green and 404s the jump at runtime. The `user-guide-builder` skill (§6) documents this gotcha as a **manual** "verify by hand" step. dev-docs already has **6** such links (`/modules/admin#installation`, `/api/server-actions#admin-actions`, `/docs/#effort-tiers`, …) with nothing checking them.
2. **No screenshot-refresh tool.** The skill references re-capturing screenshots after a UI change, but there's no guarded wrapper (the pm project added `scripts/screenshot-refresh.sh`; this repo never got it).

## Solution

A single coherent change enriching both smoke testing and the dev-docs guidance:

1. **`scripts/docs/anchor-check.cjs`** (NEW) — deterministic, zero-dep Node check:
   - Parse every `dev-docs/**/*.md` (respecting VitePress `srcExclude` where practical).
   - Extract every internal link with a `#fragment` (`](/path#anchor)` and `](relative#anchor)`).
   - Resolve the target page → collect its headings → slugify (VitePress rules: lowercase latin, spaces→`-`, strip `（）／–`, keep CJK) → assert the fragment exists.
   - Also verify referenced local assets (`![](/x.png)`, `/screenshots/*`) resolve under `dev-docs/public/`.
   - Print a clear ✓/✗ report; exit non-zero on any dead anchor/asset.
2. **Wire `anchor-check` into `scripts/smoke.sh`** — in the Dev-docs section, beside `vitepress build` (guarded: skip if no dev-docs).
3. **`scripts/screenshot-refresh.sh`** (NEW) — port + adapt the pm wrapper: precondition (app reachable at `/login`, **email login** not badge), run `node scripts/mockup/tour-app.cjs`, show the `git status` diff of `dev-docs/public/screenshots`, note PNG re-encode noise (manual refresh, not a CI gate).
4. **Update `.claude/skills/user-guide-builder/SKILL.md`** — §6 becomes "run `node scripts/docs/anchor-check.cjs`" (automated, not by hand); reference `scripts/screenshot-refresh.sh` in §2/§7; note it's a smoke gate.
5. **Update `docs/guides/dev-docs-guide.md`** — add anchor-check, screenshot-refresh, and the smoke-gate references.
6. **Fix any broken anchors** the new check surfaces (keep smoke green).

## Key Files

- `scripts/docs/anchor-check.cjs` (NEW)
- `scripts/screenshot-refresh.sh` (NEW)
- `scripts/smoke.sh` — add the anchor-check gate
- `.claude/skills/user-guide-builder/SKILL.md` — §6 + refs
- `docs/guides/dev-docs-guide.md` — references
- `dev-docs/**/*.md` — fix any anchors the check flags

## Acceptance Criteria

- [ ] `node scripts/docs/anchor-check.cjs` runs, reports per-link results, exits 0 when clean / non-zero on a dead anchor
- [ ] Any currently-broken cross-page anchors are fixed (check passes on `main`'s dev-docs content)
- [ ] `scripts/smoke.sh` runs the anchor-check (guarded SKIP if no dev-docs) and it appears in the summary
- [ ] `scripts/screenshot-refresh.sh` exists, guards on app reachability, runs the tour, shows the diff
- [ ] `user-guide-builder` SKILL.md §6 points at the automated check; `dev-docs-guide.md` documents both tools
- [ ] `cd dev-docs && pnpm build` still clean; `pnpm lint` (next-app) unaffected

## Out of Scope

- Pixel-level VRT for screenshots (the screenshot-refresh note flags this as the follow-on; VRT infra already exists via `pnpm test:vrt`)
- Rewriting dev-docs content / a full user manual (that's the user-guide-builder skill's job when invoked)
- External (http/https) link liveness checking
