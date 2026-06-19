# Rebrand Guide — Template → Your Product

This guide is for fork teams who want to replace "AI App Template" branding with their own
product name, logo, and identity. For the full step-by-step skill, invoke `/rebrand` in
Claude Code (see `.claude/skills/rebrand/SKILL.md`).

## The single-knob rule

The entire app name comes from one file: `next-app/lib/branding.ts`. Change the default
string there (or set `NEXT_PUBLIC_APP_NAME` as a build-time env var in Zeabur) and every
surface — login page, nav, footer, sidebar, document `<title>` — updates automatically.

Never hunt for hardcoded product names in individual components. If you find one, replace it
with `import { APP_NAME } from "@/lib/branding"`.

## Logo pipeline (one SVG → five targets)

Design a single SVG mark, then render it to:

1. `next-app/components/logo.tsx` — theme-aware React component (Tailwind tokens, no inline `style=`)
2. `next-app/app/icon.svg` — static favicon (literal hex colors)
3. `next-app/app/apple-icon.png` — 180×180 PNG via `rsvg-convert`
4. `next-app/app/favicon.ico` — 32×32 ICO via `rsvg-convert` + `sips`
5. `dev-docs/public/logo.svg` — docs hero/nav mark (create this file if it doesn't exist)

## Dev-docs identity

After forking, `dev-docs/.vitepress/config.mts` still points at the upstream template's
GitHub repo and org. Update: `title`, `siteTitle`, `footer.copyright`, `socialLinks` (GitHub
URL), and `editLink.pattern`. Rewrite `dev-docs/index.md` hero front-matter to your product.

## Live identity vs append-only history

- **Rewrite:** `README.md`, `CLAUDE.md` (header + "What This Project Is" + "Current State"),
  and dev-docs prose pages that describe the current product.
- **Leave as-is:** `docs/epics/**`, `docs/releases/**`, `docs/context/**` — these are dated
  records, not live identity. Rewriting them falsifies history.

## Verify

```bash
grep -rniE "<old-name>" next-app docs dev-docs \
  --include="*.ts" --include="*.tsx" --include="*.md" --include="*.mts" \
  | grep -vE "\.next/|/epics/|/releases/|/context/"
# Expect 0 matches
cd next-app && pnpm typecheck && pnpm lint
cd dev-docs && pnpm build
```

## Full skill

For the complete checklist including redeploy steps, run `/rebrand` or read
`.claude/skills/rebrand/SKILL.md`.
