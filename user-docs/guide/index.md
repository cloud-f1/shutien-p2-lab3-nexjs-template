# Introduction

Welcome to the **Your Product** user guide.

This is a placeholder page. This `user-docs/` site is a minimal, buildable VitePress
skeleton generated for a fresh fork of the AI Coding Template — it ships with no
real product content yet.

To turn this into a real end-user manual:

1. Rebrand the site (`title`, `siteTitle`, nav/sidebar copy, footer) in
   `user-docs/.vitepress/config.ts` — see the `rebrand` skill.
2. Use the `user-guide-builder` skill to walk the live app, capture screenshots, and
   write one page per screen/feature under `guide/`.
3. Wire the real Cloudflare Pages project name into
   `.github/workflows/deploy-docs.yml` (replace the `<YOUR_USERDOCS_PAGES_PROJECT>`
   placeholder) and set the `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo
   secrets.

## What belongs here vs. dev-docs/

| | `user-docs/` (this site) | `dev-docs/` |
|---|---|---|
| Audience | End users of the product | Engineers / contributors |
| Content | How to use each screen/feature | Architecture, API reference, whitepaper |
| Deploy | `deploy-docs.yml` | `deploy-dev-docs.yml` |
