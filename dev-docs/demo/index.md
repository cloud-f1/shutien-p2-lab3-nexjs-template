# Live Demo Gallery

Browse live iframe-embedded demos of the @saas template. Each demo loads your deployed Next.js app.

> **Setup required:** Set `VITEPRESS_DEMO_BASE` to your deployed Next.js app URL and rebuild the docs to enable live iframe embeds.
>
> ```bash
> VITEPRESS_DEMO_BASE=https://your-app.zeabur.app pnpm build
> ```

## Available Demos

| Module | Route | Status |
|--------|-------|--------|
| [Landing Page](/demo/landing) | `/` | Marketing surface |
| [Dashboard](/demo/dashboard) | `/dashboard` | Post-login home |
| [Account Settings](/demo/account) | `/dashboard/settings` | Profile + password |
| [Admin Panel](/demo/admin) | `/dashboard/admin` | User management |

## Quick Preview

<DemoIframe path="/" title="Landing Page" :height="400" />

## How Demos Work

1. The VitePress site (static) embeds your deployed Next.js app in an `<iframe>`
2. The `VITEPRESS_DEMO_BASE` env var is set at build time and injected into the page
3. The iframe renders the live app — all interactions (login, form submissions) work normally
4. Server Actions and session cookies work within the iframe context

## No Deployed App Yet?

If you haven't deployed yet, the demo placeholders link to `https://your-app.zeabur.app/*`. Deploy your app to Zeabur and set the env var to enable live embeds.

See the [Deployment Guide](/docs/deployment) for step-by-step instructions.
