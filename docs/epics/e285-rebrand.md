# E285 — One-knob Rebrand + Global Metadata + Demo-login Hardening

## Problem

1. **Rebrand friction.** The brand string `"AI App Template"` is hardcoded in 6+ files
   (`app/(auth)/layout.tsx`, `components/logo.tsx`, `components/marketing/marketing-nav.tsx`,
   `components/marketing/marketing-footer.tsx`, `components/app-sidebar.tsx`). A fork has to
   grep-and-replace across the tree to rebrand — there is no single knob.
2. **No global metadata.** The root `app/layout.tsx` exports no `metadata`, so there is no
   default `<title>`, no `title.template`, no `metadataBase`, and no default `description` for
   routes that don't set their own.
3. **Demo-login leaks into every non-prod build.** `app/(auth)/login/_login-form.tsx` shows the
   seeded quick-login buttons whenever `NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true"` **OR**
   `NODE_ENV !== "production"`. The `|| NODE_ENV !== "production"` fallback means any staging /
   preview / Docker build that isn't strictly `production` ships demo credentials.
4. **Logo uses inline `style=` colour overrides** (`style={{ fill: "var(--primary)" }}`), which
   the Stop verifier hook flags and the Architecture Rules forbid.
5. **`package.json`** declares no `engines` / `packageManager` — Node/pnpm drift is uncaught.
6. **`scripts/template-reset.sh`** still tries to delete `server/app/...portfolio.py` paths that
   no longer exist after the Next.js migration (dead code).

## Solution

- **`next-app/lib/branding.ts`** — single source of truth:
  `export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "AI App Template"`
  (+ `APP_DESCRIPTION`). Pure module, db-free, client-safe (zero server imports), so it can be
  imported from both Server and Client Components.
- Replace each hardcoded `"AI App Template"` with `{APP_NAME}` in the 5 UI files. Default stays
  `"AI App Template"` so unset-env behaviour is byte-identical (existing e2e brand assertion
  in `e2e/cobalt-ui.spec.ts` still passes).
- Root `app/layout.tsx` exports
  `metadata: Metadata = { title: { default: APP_NAME, template: \`%s · ${APP_NAME}\` },
   description: APP_DESCRIPTION, metadataBase: new URL(NEXT_PUBLIC_APP_URL || localhost) }`.
- `components/logo.tsx` — replace inline `style=` colour overrides with Tailwind utilities
  (`fill-primary`, `stroke-primary-foreground`).
- Demo-login gate becomes **strict**: `NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true"` only. The
  Playwright `webServer` env gains `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` so e2e is unaffected
  (e2e login fills the form directly via `loginAs`, but we wire the flag for safety + parity
  with the Makefile `local-env` which already sets it true).
- `package.json` — add `engines.node >= 22` and `packageManager: pnpm@<installed>`.
- `scripts/template-reset.sh` — remove the dead `server/app/...portfolio.py` deletion block.
- `.env.example` — document `NEXT_PUBLIC_APP_NAME` as the single rebrand knob.

## Key Files

| File | Change |
|---|---|
| `next-app/lib/branding.ts` | NEW — `APP_NAME` / `APP_DESCRIPTION` constants |
| `next-app/app/layout.tsx` | add `export const metadata` (title template + metadataBase) |
| `next-app/app/(auth)/layout.tsx` | `"AI App Template"` → `{APP_NAME}` |
| `next-app/components/logo.tsx` | `{APP_NAME}` aria-label + inline `style=` → Tailwind fills |
| `next-app/components/marketing/marketing-nav.tsx` | `"AI App Template"` → `{APP_NAME}` |
| `next-app/components/marketing/marketing-footer.tsx` | `"AI App Template"` → `{APP_NAME}` |
| `next-app/components/app-sidebar.tsx` | `"AI App Template"` → `{APP_NAME}` |
| `next-app/app/(auth)/login/_login-form.tsx` | strict demo-login gate |
| `next-app/playwright.config.ts` | webServer env `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` |
| `next-app/package.json` | `engines` + `packageManager` |
| `next-app/.env.example` | document `NEXT_PUBLIC_APP_NAME` |
| `scripts/template-reset.sh` | drop dead portfolio.py deletions |

## Acceptance

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass from `next-app/`.
- With `NEXT_PUBLIC_APP_NAME` unset, every brand surface still renders `"AI App Template"`
  (e2e `cobalt-ui` brand assertion unaffected).
- Setting `NEXT_PUBLIC_APP_NAME=Acme` at build time rebrands all 5 UI surfaces + the document
  title via one env var.
- Root layout exposes a default `<title>` and a `%s · APP_NAME` template + `metadataBase`.
- `components/logo.tsx` has no inline `style=` colour overrides (Stop-verifier clean).
- Demo buttons are shown **only** when `NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true"`; e2e login
  (form fill) still works because the flag is wired in the Playwright webServer env.
- `package.json` declares `engines.node` and `packageManager`.
- `scripts/template-reset.sh` no longer references non-existent `server/app/*portfolio*` paths.

## Out of scope

- Renaming the brand in `lib/openapi/registry.ts` / `registry.test.ts` (API doc title) and
  `drizzle/seed.ts` (demo notification copy) — these are not user-facing chrome and changing
  them would break the OpenAPI snapshot test; left for a follow-up.
- The homepage `app/page.tsx` already sets a full, intentional `metadata.title`; left untouched
  (it composes with the new root template, which is the documented behaviour).
- Any DB / schema / migration changes.
