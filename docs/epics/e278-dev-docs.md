# E278 — Onboarding / dev docs rewrite (FastAPI → Next.js)

> Phase 65 · docs · branch `feat/E278-dev-docs`
> Source: the 2026-06 FastAPI-doc audit. Onboarding + architecture docs still
> described the removed FastAPI + Vite stack (OpenAPI, SQLAlchemy/Alembic, pytest,
> Axios/MSW, uvicorn, `server/app`, `client/src`).

## Problem

A developer reading the docs was onboarded onto a stack that no longer exists.
The techstack/diagram docs described a FastAPI server + Vite SPA split; the
dev-guide + the **published VitePress site** (`dev-docs/`, deployed to Cloudflare
Pages) walked through OpenAPI/pytest; the reference docs listed the pre-reconceive
agent brain; the bilingual guides linked to removed-subsystem pages.

## Solution

Rewrite the onboarding/architecture docs to the single Next.js 16 app reality and
delete the removed-subsystem prose.

**Deleted (removed subsystems):**
- `docs/techstack/openapi-workflow.md`
- `docs/guides/openapi-patterns.md` + `docs/guides/{en,zh-TW}/openapi-patterns.md`
- `docs/guides/{en,zh-TW}/sre-observability.md`
- `docs/guides/{en,zh-TW}/ci-explained.md`

(`docs/openapi.yaml` is still referenced by stale **scripts** — its deletion is
deferred to **E280** which fixes those scripts.)

**Rewritten to Next.js (App Router · Server Components/Actions · Route Handlers ·
Drizzle · Auth.js JWT · RBAC · Vitest/Playwright · Zeabur/GCP):**
- `docs/techstack/*` — server.md (→ Next.js server layer), client.md (→ App Router
  client), architecture.md, deployment.md, ai-dev-pipeline.md, README.md,
  agent-teams.md, agents-memory.md.
- `docs/diagrams/*` — Mermaid diagrams (system-architecture, auth-flow,
  domain-structure, agent-collaboration, epic-pipeline, README) re-drawn to the
  Next.js shape.
- `docs/dev-guide/*` — api-guide (→ Server Action + Route Handler + Zod, no OpenAPI),
  testing (Vitest db-free `*-utils` + Playwright), deployment, getting-started,
  README, changelog.
- `dev-docs/` (published VitePress site) — `index.md`, `docs/*`, `demo/*`; corrected
  guard names (`requireAuth/Editor/Admin`), `proxy.ts`, `AUTH_URL`, seed accounts;
  site **builds clean** (no dead links).
- `CONTRIBUTING.md`, `docs/PRD.md`, `docs/guides/{quickstart,first-epic-walkthrough,
  README,claude-code-best-practices,custom-agents}.md`, `docs/reference/{agents,
  commands,skills}.md` (reflecting the E277-reconceived brain), `docs/visuals/agent-team.md`.
- `docs/guides/{en,zh-TW}/*` — light de-stale sweep + removed dead links to the
  deleted guides; bilingual voice preserved.

## Acceptance Criteria

- [x] Removed-subsystem prose deleted (openapi-patterns, sre-observability, ci-explained, openapi-workflow).
- [x] No **live** dead links to deleted files in `docs/` guides or `dev-docs/` (remaining
      references are in untouched history: `docs/epics/*`, `docs/context/*`, archives).
- [x] Onboarding/architecture docs describe the Next.js stack (no FastAPI/Vite/OpenAPI as current).
- [x] The published VitePress `dev-docs/` site builds clean (`pnpm build`).

## Out of Scope

- `docs/openapi.yaml` deletion + the stale scripts that reference it → **E280**.
- History (`docs/epics/**`, `docs/context/**`, changelogs) — left untouched per program decision.
- `docs/guides/deployment*.md` (Phase-59 Zeabur/GCP guides — already Next.js-correct).
