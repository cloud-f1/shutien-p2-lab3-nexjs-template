/**
 * Single-knob branding source of truth.
 *
 * Rebrand the whole template by setting ONE build-time env var:
 *   NEXT_PUBLIC_APP_NAME="Your Product"
 *
 * NEXT_PUBLIC_* vars are baked into the bundle at `next build` time — change it
 * then rebuild (it has no effect at runtime). When unset, the default keeps the
 * template's original "AI App Template" branding so nothing changes.
 *
 * This module is intentionally db-free and client-safe (zero server-only imports),
 * so it can be imported from both Server and Client Components.
 *
 * FORK GUIDANCE: To rebrand this template for your product, change the default
 * strings below OR set NEXT_PUBLIC_APP_NAME + NEXT_PUBLIC_APP_DESCRIPTION in your
 * Zeabur (or other host) environment before building. Never hardcode your product
 * name in individual components — always import APP_NAME from here.
 * Full rebrand checklist (logo pipeline, dev-docs, live vs. history rule):
 *   → .claude/skills/rebrand/SKILL.md  (invoke /rebrand in Claude Code)
 *   → docs/guides/rebrand.md           (prose guide)
 */

import packageJson from "../package.json"

/** Display name for the app — drives logos, nav, footer, sidebar, and document title. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "AI App Template"

/** Default meta description (zh-Hant); routes may override with their own metadata. */
export const APP_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() ||
  "內建認證、3 階 RBAC、模組化金流與深色主題的 Next.js SaaS 起手式。"

/**
 * App version (E322) — read directly from next-app/package.json's `version` field, so
 * the UI can never drift from a git tag: bump `package.json` per the SemVer rule in
 * CONTRIBUTING.md and the next build/deploy shows it. Rendered as a small muted label
 * in the dashboard sidebar footer (components/app-sidebar.tsx).
 */
export const APP_VERSION = packageJson.version
