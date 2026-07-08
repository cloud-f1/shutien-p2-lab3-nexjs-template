# E322 — CI / Deploy / Release Hardening + Doctrine

> Phase 75 · ops · toolchain · backport-wave-2
> Source: fork `.github/workflows/*`, `Makefile`, `deploy/`, `CLAUDE.md` doctrine

> Status: ⬜ pending

## Problem

The template's CI + deploy + docs pipeline lags the hardening the fork learned in production:

1. **CI is `workflow_dispatch`-only (disabled)** — no push/PR gate. And when enabled it has the flaws the fork fixed: unpinned action tags (supply-chain risk), default-broad `permissions`, and no `package_json_file` pointer (there's no root `package.json` — actions default-fail).
2. **No docs-build gate** — dead links / broken anchors reach main.
3. **Single mis-targeted docs workflow** — the fork found one workflow building dev-docs but deploying to the *user-docs* Pages project, so user-docs never auto-deployed. The template has no `user-docs/` (end-user manual) pipeline at all.
4. **No umbrella verify gate + only one deploy road** — no `make verify`, no GCP Cloud Run road as a make target (the `deploy-config` skill describes Road 2 but there's no target).
5. **Undocumented env doctrine** — no codified runtime-vs-build-time rule, per-env seeding rule, multi-env deploy table, or version-in-UI source, so forks re-learn `NEXT_PUBLIC_*`-bakes-at-build the hard way.

## Solution

### A. CI hardening (`.github/workflows/ci.yml`)
- Re-enable `push` + `pull_request` triggers.
- **SHA-pin** every action to a full commit hash.
- Add least-privilege `permissions: { contents: read }`.
- Set `package_json_file: next-app/package.json` on the pnpm/node setup.
- Add a **docs-build job**: staleness-check + VitePress build (dev-docs) to fail on dead links pre-merge.

### B. Docs-deploy split + user-docs pipeline
- Split into `deploy-dev-docs.yml` (dev-docs → its Pages project) + `deploy-docs.yml` (user-docs → its own project), each **path-scoped** (`dev-docs/**` vs `user-docs/**`).
- Scaffold `user-docs/` VitePress site (own `package.json`, `guide/` skeleton, `public/`, `_redirects`) as a first-class sibling to `dev-docs/` — the `user-guide-builder` skill's output as a shipping pipeline.

### C. Makefile + deploy
- `make verify` — umbrella gate: staleness-check + pre-merge-check (typecheck·lint·unit) + `check:orphans` (E320) + `test:int` (E321) + dev-docs build.
- `make deploy-gcp` — Cloud Run + Cloud SQL + Artifact Registry road (separate migrate image run as a Cloud Run Job, secrets via Secret Manager).
- `make db-migrate-prod` — guarded prod migration (requires `CONFIRM=1`).
- `deploy/.env.deploy.example` — documents Zeabur + GCP deploy-time vars.

### D. Doctrine (docs, additive)
- `CONTRIBUTING.md` — "Ship discipline" section (one concern per branch / rebase-don't-stack / verify disjointness with `git diff --name-only` + `git merge-tree` / run `make verify` before push).
- `CLAUDE.md` / `docs/` — **runtime-vs-build-time env doctrine** (`ENABLE_*` / `SENTRY_DSN` are server-side runtime, toggle per-service with no rebuild; `NEXT_PUBLIC_*` bake at build) · **per-env seeding** (dev = `db:seed`; stg/prd = `db:seed-admin` → `db:seed-baseline`) · **multi-env deploy table** (env × branch × project × URL) · **version-in-sidebar**: `APP_VERSION` in `lib/branding.ts` reads `package.json` directly (no git-tag↔UI drift).

## Key Files

- `.github/workflows/ci.yml`, `deploy-dev-docs.yml` (NEW), `deploy-docs.yml` (NEW)
- `user-docs/` (NEW VitePress site skeleton)
- `Makefile` — `verify`, `deploy-gcp`, `db-migrate-prod`, `image` targets
- `deploy/.env.deploy.example` (NEW)
- `CONTRIBUTING.md` — Ship discipline section
- `CLAUDE.md` + relevant `docs/` — env/seeding/deploy/version doctrine
- `next-app/lib/branding.ts` — `APP_VERSION` from `package.json`

Reference (fork, read-only): `../ai-rc-engineer-pm/.github/workflows/`, `../ai-rc-engineer-pm/Makefile`, `../ai-rc-engineer-pm/deploy/`, `../ai-rc-engineer-pm/CLAUDE.md`

## Implementation

### Phase 1 — CI
- Harden `ci.yml` (triggers, SHA-pin, permissions, `package_json_file`, docs-build job). Verify it goes green on a test PR.

### Phase 2 — docs workflows + user-docs
- Split the two deploy workflows path-scoped; scaffold `user-docs/` (minimal buildable site). Don't wire real Cloudflare project IDs — use placeholders + document in the zeabur/cf-deploy skill.

### Phase 3 — Makefile + deploy env
- Add `verify` / `deploy-gcp` / `db-migrate-prod` / `image`; `verify` chains E320 `check:orphans` + E321 `test:int`.
- Add `deploy/.env.deploy.example`.

### Phase 4 — doctrine
- Additive edits to `CONTRIBUTING.md` + `CLAUDE.md` + `docs/`. Add `APP_VERSION` wiring + show it in the sidebar footer.

## Acceptance Criteria

- [ ] `ci.yml` runs on push+PR, actions SHA-pinned, `permissions: contents: read`, `package_json_file` set, docs-build job present; green on a test PR
- [ ] Two path-scoped docs-deploy workflows; `user-docs/` builds locally (`pnpm --dir user-docs build`)
- [ ] `make verify` runs staleness + typecheck + lint + unit + `check:orphans` + `test:int` + dev-docs build, exits 0
- [ ] `make deploy-gcp` target exists with Cloud Run + Cloud SQL steps (placeholders, documented); `make db-migrate-prod` guarded by `CONFIRM=1`
- [ ] `deploy/.env.deploy.example` documents Zeabur + GCP vars
- [ ] `CONTRIBUTING.md` has Ship-discipline; `CLAUDE.md`/docs codify runtime-vs-build-time env + per-env seeding + deploy table
- [ ] Sidebar shows `APP_VERSION` sourced from `package.json`

## Cross-Epic

- E320 + E321 — `make verify` consumes `check:orphans` + `test:int`
- E318 (Phase 74, dev-docs Cloudflare deploy) — the docs-split builds on E318's Cloudflare SOP
- E322 doctrine reinforces the deploy-config + zeabur-deploy skills

## Out of Scope

- Real Cloudflare/GCP project IDs + secrets — placeholders only; wiring is per-fork
- Full end-user manual *content* — pipeline + skeleton only (that's `user-guide-builder`'s job per-product)
- Sentry wiring — that's an E323 optional module
