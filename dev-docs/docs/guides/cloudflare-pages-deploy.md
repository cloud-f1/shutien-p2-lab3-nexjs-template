# Cloudflare Pages Deploy — dev-docs SOP

This guide covers deploying the `dev-docs/` VitePress site to Cloudflare Pages.

## Prerequisites

You need two credentials from the Cloudflare dashboard:

| Variable | Where to find it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token (use the **Edit Cloudflare Workers** template, or create a custom token with **Cloudflare Pages: Edit** permission) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right-hand sidebar → Account ID |

Export them in your shell before running any deploy commands:

```bash
export CLOUDFLARE_API_TOKEN=your_token_here
export CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

## Build

From the repo root:

```bash
cd dev-docs && pnpm install && pnpm build
```

Or via the Makefile shortcut:

```bash
make dev-docs-build
```

The built site lands in `dev-docs/.vitepress/dist/`.

## Deploy

```bash
npx wrangler pages deploy dev-docs/.vitepress/dist \
  --project-name ai-coding-nexjs-template-docs \
  --branch main \
  --commit-dirty=true
```

Or via the Makefile (builds then deploys):

```bash
make dev-docs-deploy
```

> `--commit-dirty=true` is required when you have uncommitted changes in the working tree —
> Wrangler refuses to deploy a dirty tree without this flag.

## Environment Variables

Two optional env vars control where demo iframes and the API playground point:

| Variable | Purpose | Example |
|---|---|---|
| `VITEPRESS_DEMO_BASE` | Base URL for live demo iframes | `https://your-app.zeabur.app` |
| `VITEPRESS_API_BASE` | Base URL for the API playground | `https://your-app.zeabur.app/api` |

Set these in the Cloudflare Pages dashboard under **Settings → Environment Variables** (Production), or export them locally before building:

```bash
export VITEPRESS_DEMO_BASE=https://your-app.zeabur.app
export VITEPRESS_API_BASE=https://your-app.zeabur.app/api
make dev-docs-build
```

## Cloudflare Dashboard Build Settings

If you connect the Cloudflare Pages project to your GitHub repo for automatic deploys, use these build settings:

| Setting | Value |
|---|---|
| Framework preset | VitePress |
| Build command | `pnpm build` |
| Build output directory | `.vitepress/dist` |
| Root directory | `dev-docs` |
| Node.js version | 20 (or later) |

> Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as encrypted environment variables in the Cloudflare Pages project settings — not in `dev-docs/.env` files.

## Branch Preview Deploys

To deploy a preview (e.g. from a PR branch), change `--branch main` to `--branch preview` (or any slug you choose):

```bash
npx wrangler pages deploy dev-docs/.vitepress/dist \
  --project-name ai-coding-nexjs-template-docs \
  --branch preview \
  --commit-dirty=true
```

Cloudflare Pages creates a unique preview URL per branch: `https://<branch-slug>.ai-coding-nexjs-template-docs.pages.dev`.

## GitHub Actions (Automatic Deploy)

A GitHub Actions workflow is included at `.github/workflows/deploy-dev-docs.yml` that deploys automatically on every push to `main` that touches `dev-docs/**` (path-scoped and SHA-pinned; a sibling `deploy-docs.yml` handles the separate `user-docs/` site).

Required GitHub repository secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Add them at **Settings → Secrets and variables → Actions → New repository secret**.

## Local Preview

To preview the docs site locally before deploying:

```bash
make dev-docs-preview
# or
cd dev-docs && pnpm dev
```

The local dev server runs at `http://localhost:5173` with hot-reload.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Authentication error` | Check that `CLOUDFLARE_API_TOKEN` is set and has Pages edit permission |
| `Project not found` | The `--project-name` flag must match the project name in Cloudflare Pages exactly |
| `You must provide a directory` | Run `make dev-docs-build` first — the dist folder must exist |
| Dead links in build output | Run `cd dev-docs && pnpm build` and check for broken links in the console output |
