# User-Guide Mode — Flipping dev-docs to an End-User Manual

By default, `dev-docs/` is an **engineer-facing** site: getting-started guides, module catalog, API reference, whitepaper. When your fork has **paying users** (not developers) as the primary audience, you can flip the site to a customer-facing manual.

## When to Flip

Flip to user-guide mode when:

- Your fork has shipped a product and real users are signing up
- The primary readers are end-users who care about features, not engineers who care about architecture
- You want a branded help center or documentation portal at a separate URL

Keep the default engineer-facing mode when:

- Your primary audience is developers evaluating or building on the template
- You are still in active development and the docs are mostly for your own team

## How to Flip

The `FORK TEAMS — AUDIENCE SPLIT PATTERN` comment in `dev-docs/.vitepress/config.mts` describes the flip. Here is the step-by-step:

### Step 1 — Exclude Engineer Pages from the Build

In `dev-docs/.vitepress/config.mts`, uncomment and adjust `srcExclude`:

```ts
export default defineConfig({
  // Exclude engineer-facing pages from the published build:
  srcExclude: ['docs/**', 'api/**', 'whitepaper/**', 'README.md'],

  // ... rest of config
})
```

Adjust the glob patterns to match which directories you want to hide. The excluded pages are still present in the repository — they just are not included in the built site.

### Step 2 — Update Nav and Sidebar

Remove engineer-only nav items and sidebar sections. Replace them with user-facing entries:

```ts
nav: [
  { text: 'Getting Started', link: '/user-guide/' },
  { text: 'Features', link: '/user-guide/features' },
  { text: 'FAQ', link: '/user-guide/faq' },
  { text: 'Contact Support', link: '/user-guide/support' },
],
```

### Step 3 — Add Redirects for Removed Paths

If you previously published the engineer-facing site at the same domain, add redirect rules to `dev-docs/public/_redirects` so old links do not 404:

```
/docs/*     /user-guide/ 301
/api/*      /user-guide/ 301
```

Cloudflare Pages serves `_redirects` automatically from the `public/` folder.

### Step 4 — Rewrite Identity Fields

In `dev-docs/.vitepress/config.mts`:

```ts
export default defineConfig({
  title: 'Your Product Help Center',
  description: 'Getting started and feature guides for Your Product users.',

  themeConfig: {
    siteTitle: 'Your Product Docs',

    footer: {
      message: 'Need help? Email support@yourproduct.com',
      copyright: 'Copyright © 2026 Your Product',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-org/your-product' },
    ],
  },
})
```

Also rewrite `dev-docs/index.md` — update the hero title, tagline, and action buttons to address users rather than developers.

### Step 5 — Generate the User-Guide Content

Use the `user-guide-builder` skill to generate the user-manual content from your product's feature set:

```
/athena:tony generate user guide for [your product name]
```

The `user-guide-builder` skill produces 繁體中文 user manual pages covering login, account settings, key workflows, and FAQ — ready to drop into `dev-docs/user-guide/`.

## Running a Second Site (Keep Both)

You can maintain two separate VitePress sites in parallel — one for engineers, one for users:

```
dev-docs/          → engineer-facing site → https://docs.yourproduct.com
user-docs/         → user-facing manual  → https://help.yourproduct.com
```

To set up a second site:

1. Copy `dev-docs/` to `user-docs/` (or create a new VitePress project in `user-docs/`)
2. Apply the audience-split changes only to `user-docs/`
3. Add Makefile targets for `user-docs-preview`, `user-docs-build`, `user-docs-deploy`
4. Create a separate Cloudflare Pages project pointing at `user-docs/.vitepress/dist`
5. Point `user-docs` at a subdomain: `help.yourproduct.com`

This approach keeps the engineer docs unmodified while giving users a clean, product-branded manual.

## Checklist

- [ ] `srcExclude` configured in `config.mts`
- [ ] `nav` and `sidebar` updated for user audience
- [ ] `dev-docs/public/_redirects` created (if migrating from engineer-facing URL)
- [ ] `title`, `siteTitle`, `footer`, hero in `index.md` rewritten
- [ ] User-guide content generated (see `user-guide-builder` skill)
- [ ] Preview built locally: `make dev-docs-preview`
- [ ] Deployed to Cloudflare Pages: `make dev-docs-deploy`
