# Dev-Docs Guide — VitePress Site for Fork Teams

The `dev-docs/` directory is a VitePress site that serves as the engineer/template reference
for this project. Fork teams can extend it to publish an end-user manual alongside the
existing developer docs.

For the full step-by-step skill, invoke `/user-guide-builder` in Claude Code (see
`.claude/skills/user-guide-builder/SKILL.md`).

## What dev-docs is (by default)

The template ships `dev-docs/` as an **engineer-facing** reference: getting-started, module
catalog, API reference, whitepaper, and deployment docs. It is NOT an end-user manual by
default — the template is developer-facing.

## When to pivot to a user manual

If your fork builds a product where non-technical end users need documentation, you can
transform (or augment) `dev-docs/` into a user-facing manual using the `user-guide-builder`
skill. The skill covers the full pipeline:

1. **Audience audit** — split engineer vs. user content; add `srcExclude` to
   `dev-docs/.vitepress/config.mts` to hide engineer pages from the published build.
2. **Boot the app** — `docker compose up --build -d` + `pnpm db:seed` → demo logins available.
3. **Screenshot tour** — `scripts/mockup/tour-app.cjs` logs in via email+password, walks every
   page, and writes PNGs to `dev-docs/public/screenshots/`.
4. **Domain digest** — one agent mines epics into a rules cheat-sheet that all writers share.
5. **Per-page writers** — one agent per manual page (parallel), grounded in screenshots +
   the digest + actual component source.
6. **Anchor verification** — VitePress validates page links but NOT `#fragment` anchors;
   hand-verify cross-page `page#anchor` references after writing.
7. **Build + redeploy** — `cd dev-docs && pnpm build`, then publish via `gh-cf-deploy` skill.

## Redirects for removed paths

When you remove pages from the published build (e.g. `/docs/`, `/api/`), add redirect rules
to `dev-docs/public/_redirects` so bookmarked or edge-cached URLs land somewhere useful
instead of 404ing. See `dev-docs/public/_redirects` for the documented pattern.

## Audience-split pattern (VitePress `srcExclude`)

`dev-docs/.vitepress/config.mts` contains a commented-out `srcExclude` example. Activate it
only when your fork pivots to a user-facing manual:

```ts
// dev-docs/.vitepress/config.mts — uncomment to hide engineer docs from end-user build
// srcExclude: ['docs/**', 'api/**', 'README.md'],
```

Keep the engineer docs in the repo for maintainers — just exclude them from the published
VitePress output.

## Build command

```bash
cd dev-docs
pnpm install --prefer-offline
pnpm build   # runs generate-catalog.mjs first, then vitepress build
```

## Full skill

For the complete checklist including screenshot pipeline and anchor verification, run
`/user-guide-builder` or read `.claude/skills/user-guide-builder/SKILL.md`.
