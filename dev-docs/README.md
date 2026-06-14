# dev-docs — @saas VitePress Documentation Site

A VitePress (Vue/static) documentation site for the @saas Next.js modular registry SaaS template.

## Sections

| Section | Description |
|---------|-------------|
| **Docs Reader** | Surfaces `docs/dev-guide/` + `docs/guides/` |
| **Module Catalog** | Generated from `next-app/registry.json` + module manifests |
| **Whitepaper** | Full scope whitepaper — bilingual EN + 繁中 |
| **API Reference** | Route handlers + Server Actions + interactive playground |
| **Live Demo Gallery** | iframe-embeds of the deployed Next.js app |

## Development

```bash
cd dev-docs
pnpm install
pnpm dev          # VitePress dev server → http://localhost:5173
pnpm build        # static build → .vitepress/dist/
pnpm preview      # preview the build
pnpm catalog      # regenerate module catalog from registry.json
```

## Build

`pnpm build` runs two steps:

1. `node scripts/generate-catalog.mjs` — reads `next-app/registry.json` and module manifests, emits `modules/*.md`
2. `vitepress build` — builds the static site to `.vitepress/dist/`

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITEPRESS_DEMO_BASE` | Base URL for iframe demo embeds (e.g. `https://your-app.zeabur.app`) |
| `VITEPRESS_API_BASE` | Base URL for the interactive API playground |

Set these at build time for the Cloudflare Pages deploy.

## Deploy to Cloudflare Pages

Deployment is via the `gh-cf-deploy` skill (requires `CLOUDFLARE_API_TOKEN`):

```bash
# From Claude Code
/gh-cf-deploy
```

Manual setup instructions: `deploy/cloudflare-pages.md`

> **Note:** Actual deployment is deferred until `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
> are available. The build (`pnpm build`) produces the correct static output (`deploy/cloudflare-pages.md`
> documents all settings). Run `gh-cf-deploy` from Claude Code once credentials are configured.

## Module Catalog Generation

The catalog is auto-generated from `next-app/registry.json` + `module.manifest.json` files:

```bash
pnpm catalog
# → writes modules/index.md
# → writes modules/landing.md, modules/account.md, modules/admin.md, ...
```

Run this after adding new modules to the registry.

## Vue Components

Custom Vue components registered in `.vitepress/theme/`:

| Component | Usage |
|-----------|-------|
| `<ApiPlayground>` | Interactive HTTP request form — POSTs to deployed Next.js route handlers |
| `<DemoIframe>` | Browser-chrome iframe embed — renders deployed Next.js app pages |
| `<ModuleCard>` | Module catalog card with icon, summary, tags, and links |
