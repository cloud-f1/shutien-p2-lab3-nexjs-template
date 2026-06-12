# E34: Template Hygiene — Parameterize All Domain Remnants

> **Phase**: 13 | **Size**: S (8 SP) | **Priority**: P0
> **Depends on**: no deps
> **Source**: Strategy Cycle 2 — AUDIT finding #1, #2, #3

---

## Problem Statement

The project claims to be a "universal SaaS template" but ships with **40+ hardcoded references** to the original investment-tracker domain (`place_invested`, `placeinvested`, `pi_user`, `pi_pass`, `place-invested`). A full codebase grep (2026-03-14) found occurrences in these files:

**Config & Infrastructure (must parameterize):**
- `docker-compose.yml` — 4 refs (`place_invested`, `pi_user`, `pi_pass` in defaults)
- `.env.local` — 4 refs (`POSTGRES_USER=pi_user`, `POSTGRES_PASSWORD=pi_pass`, `POSTGRES_DB=place_invested`, `DATABASE_URL`, `SMTP_FROM`)
- `server/app/core/config.py` — 2 refs (default `DATABASE_URL`, `SMTP_FROM`)
- `server/.env.example` — 2 refs (`DATABASE_URL`, `SMTP_FROM`)
- `server/alembic.ini` — 1 ref (`sqlalchemy.url`)
- `.claude-plugin/plugin.json` — 1 ref (`"name": "place-invested-pipeline"`)

**Documentation (must neutralize):**
- `docs/guides/quickstart.md` — 4 refs (DB creation, connection URL, troubleshooting)
- `dev-docs/public/DEVELOPER_DOCS.md` — 1 ref (config table)
- `docs/pre-release-checklist.md` — 1 ref (local dev instruction)

**Dashboard UI (static sample data — replace with `{{PROJECT_SLUG}}`):**
- `client/src/pages/dashboard/DashboardPage.tsx` — 16 refs (project slugs, source labels)

**Design Blueprints (reference HTML — low priority):**
- `docs/design/dashboard.html` — 14 refs (wireframe sample data)
- `docs/design/dev-guide.html` — 1 ref (directory listing)

**.env.production** — already generic (placeholders only, no `place_invested`). However, both `.env.local` and `.env.production` are **tracked in git** (`git ls-files` confirms), which is an anti-pattern. Current `.gitignore` only ignores the exact filename `.env`, not `.env.local` or `.env.production`.

Additionally, `server/app/domains/places/` and `server/app/domains/portfolios/` ship as live example code — **8 server files** (4 per domain: models, schemas, endpoints, __init__) and **14 client files** (7 per domain: page, CSS, test, 4 components) that new users inherit but don't need.

## Stories

### S1: Parameterize Config Defaults
**As a** template user running `pnpm new-site`,
**I want** all database names, SMTP addresses, and docker-compose defaults to use my project name,
**So that** no `place_invested` artifacts remain after scaffolding.

**Acceptance Criteria:**
- [ ] `docker-compose.yml` defaults use generic names (`saas_user`, `saas_pass`, `saas_dev`)
- [ ] `server/app/core/config.py` default DB URL uses `saas_dev` (not `place_invested`)
- [ ] `server/alembic.ini` default URL uses same generic names
- [ ] `server/.env.example` uses generic names
- [ ] `.claude-plugin/plugin.json` name uses `{{PROJECT_SLUG}}-pipeline`
- [ ] `client/src/pages/dashboard/DashboardPage.tsx` sample data uses `{{PROJECT_SLUG}}`
- [ ] `pnpm new-site` scaffold replaces all tokens with project-specific values
- [ ] `grep -ri "place.invested\|pi_user\|pi_pass"` returns 0 results after scaffold (excluding `docs/design/`, `docs/epics/e34-*`)

### S2: Convert .env Files to Templates
**As a** developer forking this template,
**I want** `.env.local` and `.env.production` to be `.env.example` files instead,
**So that** git doesn't track credentials and forks don't inherit stale configs.

**Acceptance Criteria:**
- [ ] `.env.local` → `.env.local.example` (tracked) + `.env.local` (gitignored)
- [ ] `.env.production` → `.env.production.example` (tracked) + `.env.production` (gitignored)
- [ ] `.gitignore` updated: `.env*` with `!.env*.example` exceptions
- [ ] `pnpm new-site` copies `.example` → actual files with project-specific values
- [ ] README/quickstart updated with "copy .env.example" step

### S3: Strip Example Domains on Scaffold
**As a** new user,
**I want** `pnpm new-site` to optionally remove the places/portfolios example domains,
**So that** I start with a clean slate for my own domain.

**Acceptance Criteria:**
- [ ] `pnpm new-site` prompts: "Remove example domains? (places, portfolios)" — default Yes
- [ ] If Yes: removes `server/app/domains/places/` (4 files), `server/app/domains/portfolios/` (4 files)
- [ ] If Yes: removes `client/src/pages/places/` (7 files), `client/src/pages/portfolios/` (7 files)
- [ ] If Yes: removes corresponding OpenAPI paths and component schemas
- [ ] Domain registry auto-discovery handles missing domains gracefully (no broken imports)
- [ ] Router includes in `server/app/main.py` skip missing domains (dynamic import or try/except)
- [ ] Client routes in `App.tsx` skip missing domain pages (lazy import guard)
- [ ] Alembic migrations remain clean (domain tables simply not created)

### S4: Clean Documentation References
**As a** template user reading docs,
**I want** all guides to reference generic examples (not investment-tracker specifics),
**So that** the docs feel like a universal template.

**Acceptance Criteria:**
- [ ] `docs/guides/quickstart.md` uses generic domain examples (`saas_dev`, `saas_user`)
- [ ] `dev-docs/public/DEVELOPER_DOCS.md` config table uses generic defaults
- [ ] `docs/pre-release-checklist.md` uses generic defaults
- [ ] No `place_invested`/`pi_user`/`pi_pass` in any user-facing documentation

## Implementation Order

1. **S1** first — parameterize config defaults (direct find-and-replace, lowest risk)
2. **S2** second — convert .env files (git rm + rename + gitignore update)
3. **S4** third — clean docs (text changes only)
4. **S3** last — domain stripping (most complex, touches `pnpm new-site` CLI)

## Files To Modify (complete list)

| Story | File | Action |
|-------|------|--------|
| S1 | `docker-compose.yml` | Replace 4 default values |
| S1 | `server/app/core/config.py` | Replace 2 defaults |
| S1 | `server/alembic.ini` | Replace 1 URL |
| S1 | `server/.env.example` | Replace 2 defaults |
| S1 | `.claude-plugin/plugin.json` | Replace name |
| S1 | `client/src/pages/dashboard/DashboardPage.tsx` | Replace 16 sample-data refs |
| S2 | `.env.local` | `git rm` → rename to `.env.local.example` |
| S2 | `.env.production` | `git rm` → rename to `.env.production.example` |
| S2 | `.gitignore` | Add `.env*` / `!.env*.example` rules |
| S3 | `scripts/new-site.ts` (or equivalent) | Add domain-removal prompt + logic |
| S4 | `docs/guides/quickstart.md` | Replace 4 refs |
| S4 | `dev-docs/public/DEVELOPER_DOCS.md` | Replace 1 ref |
| S4 | `docs/pre-release-checklist.md` | Replace 1 ref |

## No OpenAPI Changes

This epic is config/cleanup only. No new API endpoints, no schema changes. `docs/openapi.yaml` is only touched in S3 if domains are stripped (removing existing paths, not adding new ones).

## Risk Notes

- Migration: existing users who forked with `.env.local` tracked will need to manually gitignore
- Domain removal must respect Alembic — don't break migration chain for users who kept example domains
- `docs/design/dashboard.html` and `docs/design/dev-guide.html` contain sample data refs but are design blueprints — low-priority, can remain as-is or be updated as stretch goal
