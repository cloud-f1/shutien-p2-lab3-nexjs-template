# E318 — Dev-Docs Cloudflare Pages Deploy Enhancement

**Phase:** 74
**Priority:** P1
**Size:** S
**Branch:** `feat/E318-devdocs-cloudflare-deploy`

---

## Problem

The `dev-docs/` VitePress site deploys to Cloudflare Pages, but:

1. **`dev-docs/docs/deployment.md`** references a `gh-cf-deploy` skill that does not exist — the Cloudflare Pages section is a dead reference.
2. **No `Makefile` targets** for dev-docs operations — developers must remember the full `wrangler` deploy command.
3. **No GitHub Actions CI** — every deploy is a manual `npx wrangler pages deploy` invocation; pushes to main do not trigger a deploy.
4. **No user-guide flip guide** — `dev-docs/.vitepress/config.mts` has a `FORK TEAMS — AUDIENCE SPLIT` comment describing how to pivot the site to an end-user manual, but there is no matching VitePress page explaining the flip.

---

## Solution

Four concrete deliverables:

1. **`dev-docs/docs/guides/cloudflare-pages-deploy.md`** — replace the dead `gh-cf-deploy` reference with the actual SOP. Content:
   - Prerequisites: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` env vars
   - Build: `cd dev-docs && pnpm install && pnpm build`
   - Deploy: `npx wrangler pages deploy dev-docs/.vitepress/dist --project-name ai-coding-nexjs-template-docs --branch main --commit-dirty=true`
   - Environment variables: `VITEPRESS_DEMO_BASE`, `VITEPRESS_API_BASE` (point demo iframes + API playground at deployed Next.js app)
   - Cloudflare dashboard build settings (root directory: `dev-docs`, build command: `pnpm build`, output: `.vitepress/dist`)
   - Branch preview: `--branch preview` for PR preview deploys

2. **`Makefile` targets** (append after existing targets):
   - `dev-docs-preview` — run `cd dev-docs && pnpm dev` for local preview
   - `dev-docs-build` — run `cd dev-docs && pnpm install && pnpm build`
   - `dev-docs-deploy` — build + `npx wrangler pages deploy ...` (requires env vars)

3. **`.github/workflows/dev-docs.yml`** — GitHub Actions: on push to `main` (path filter: `dev-docs/**`), build + deploy to Cloudflare Pages. Secrets needed: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
   ```yaml
   name: Deploy dev-docs
   on:
     push:
       branches: [main]
       paths: ['dev-docs/**']
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
           with: { version: 9 }
         - run: cd dev-docs && pnpm install && pnpm build
         - run: npx wrangler pages deploy dev-docs/.vitepress/dist
                  --project-name ai-coding-nexjs-template-docs --branch main
           env:
             CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
             CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
   ```

4. **`dev-docs/docs/guides/user-guide-mode.md`** — guide for fork teams that want to flip the site to an end-user manual (references the `FORK TEAMS` comment already in `config.mts`):
   - When to flip: "your fork has paying users, not developers, as the primary audience"
   - How to flip: uncomment `srcExclude`, update `nav`/`sidebar`, add `_redirects`, rewrite hero + footer
   - Optional: how to run a SECOND site (keep dev-docs for engineers, add a `/user-guide/` site for customers)
   - Link to the `user-guide-builder` skill for generating the user-guide content

5. **Update `dev-docs/docs/deployment.md`** — fix the Cloudflare Pages section: replace the stale `gh-cf-deploy skill` reference with a link to the new `cloudflare-pages-deploy.md` guide.

---

## Key Files

```
dev-docs/docs/guides/cloudflare-pages-deploy.md   (NEW)
dev-docs/docs/guides/user-guide-mode.md           (NEW)
dev-docs/docs/deployment.md                       (MODIFIED — fix dead ref)
.github/workflows/dev-docs.yml                    (NEW)
Makefile                                           (MODIFIED — 3 new targets)
```

Update `dev-docs/.vitepress/config.mts` sidebar to add:
```
{ text: 'Cloudflare Pages Deploy', link: '/docs/guides/cloudflare-pages-deploy' },
{ text: 'User-Guide Mode', link: '/docs/guides/user-guide-mode' },
```

---

## Acceptance Criteria

- [ ] `dev-docs/docs/guides/cloudflare-pages-deploy.md` exists with accurate step-by-step deploy SOP
- [ ] `dev-docs/docs/deployment.md` no longer references `gh-cf-deploy`; links to new guide
- [ ] `make dev-docs-build` succeeds locally
- [ ] `.github/workflows/dev-docs.yml` passes `act` dry-run (or is syntactically valid YAML)
- [ ] `dev-docs/docs/guides/user-guide-mode.md` exists with audience-split flip guide
- [ ] `dev-docs/.vitepress/config.mts` sidebar updated with 2 new links

---

## Out of Scope

- Actual Cloudflare Pages project creation (manual step requiring account)
- Running the deploy in this PR (requires `CLOUDFLARE_API_TOKEN` in env)
- Converting dev-docs to user-guide mode (guide only, not the conversion itself)
- Updating the VitePress content for specific product features

---

## Cross-Epic

- Depends on: none
- Related: E311 (dev-docs integrity — anchor-check), E305 (user-guide-builder skill)
