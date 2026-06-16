# E280 — Stale scripts / config cleanup (FastAPI → Next.js)

> Phase 65 · tooling · branch `feat/E280-stale-scripts`
> Source: the 2026-06 FastAPI-doc audit + a read-only classification of every
> `scripts/*` + config file. The build/dev tooling still targeted the removed
> FastAPI(`server/`) + Vite(`client/`) + Alembic + pytest + OpenAPI stack.

## Problem

The `Makefile` default path (`make go`) bootstrapped a FastAPI server + Vite
client; `make dev/server/client/test/lint/migrate` all targeted the removed
stack; and ~15 scripts only worked against `server/`/`client/`/Alembic/OpenAPI.
`.pre-commit-config.yaml` ran `ruff` + an Alembic migration-linter; the root
`.dockerignore` was for the deleted `client/Dockerfile`; two `@deployer` pre-deploy
gates re-ran schemathesis + Alembic offline-SQL.

## Solution

**Deleted dead-stack scripts** (only worked with `server/`/`client/`/Alembic/OpenAPI):
`new-site.sh` + `scripts/new-site/` (the whole Site-Builder CLI + its tests),
`doctor.sh`, `doctor-production.sh`, `deploy-cloudrun.sh`, `deploy-zeabur.sh`
(stale 2-service deploy; real Zeabur deploy is `deploy/deploy-zeabur.sh` +
the `deploy-config` skill), `tutorial.sh`, `verify-pg-migrations.sh`,
`migration-review.sh`, `new-domain.sh` (Next.js path is `/athena:domain`),
`verify-customization.sh`, `generate-env.sh`, `check-prereqs.sh`,
`strip-to-core.sh`, `build-web.sh`, `scripts/checks/check-error-budget.sh`.

**Rewrote the `Makefile`** to a Next.js-only surface: `go`/`local*` happy path
(Docker Postgres+Mailpit + `pnpm dev` on :3000), Drizzle DB targets
(`migrate`/`db-generate`/`db-seed`/`db-test-migrate`/`db-studio`), gates
(`test`/`test-coverage`/`test-e2e`/`lint`/`typecheck`/`ci-all`→`pre-merge-check.sh`/
`smoke`/`guard-selftest`), `docker-up/down/logs/ps`, `deploy` (points at the
`deploy-config` skill + guides), kept `dev-docs`/`drift-check`/`new-project`/`reset`.
Removed every `server`/`client`/`uv`/`alembic`/`pytest`/`generate-types`/`new-site` target.

**Fixed config + hooks:**
- `.pre-commit-config.yaml` — dropped `ruff`/`ruff-format` + the Alembic
  migration-linter; kept generic file-hygiene hooks (+ check-yaml/merge-conflict).
- Deleted the root `.dockerignore` — vestigial (it was for `client/Dockerfile`;
  both compose contexts build from `./next-app`, which has its own `.dockerignore`).
- `.husky/pre-commit` — already Next.js-correct (ESLint on `next-app`), kept as-is.
- `scripts/hooks/pre-deploy-guard.sh` — removed the dead Gate 7 (schemathesis
  OpenAPI conformance) + Gate 7b (Alembic migration-SQL emit); migration safety
  is now `pnpm db:test-migrate` + `drizzle-kit check` in `@qa`/`@deployer`.
- `scripts/db-backup.sh` — compose service `db` → `postgres` (matches the real compose).
- `.claude/commands/athena/autopilot.md` — deploy step pointer `scripts/deploy-zeabur.sh`
  → `make deploy` (deploy-config skill / `deploy/deploy-zeabur.sh` / GCP).

## Verification

- `make help` parses; `bash -n` clean on edited scripts.
- `make guard-selftest` → 19/0 (Stop-verifier integrity preserved; not modified).
- No dangling references to deleted scripts in executable wiring
  (`Makefile`/`.claude/settings.json`/`.husky`/`.pre-commit-config.yaml`).

## Out of Scope / deferred (coupled to other branches)

- **`docs/openapi.yaml`** + **`scripts/hooks/post-spec-openapi-lint.sh`** + the
  Stop-verifier **Rules 19/20** (OpenAPI/Alembic Stop gates): a coupled cluster.
  Deleting `openapi.yaml` would trip Rule 20 on this branch, and the hook is wired
  in `@spec-writer` frontmatter — which **E277 (#26)** reconceives. Best removed in
  a micro-follow-up once #26 merges (editing the Stop gate mid-session is avoided
  for safety). `post-spec-openapi-lint.sh` only fires on `*openapi.yaml` edits
  (which no longer happen), so it is inert.
- Stale references to the deleted scripts inside `.claude/agents/{dba,qa}.md` +
  `.claude/commands/athena/{dba,domain}.md` are **already removed on E277 (#26)** —
  merge #26 with/before this PR. (They are markdown instructions, not executed code.)
- `docs/context/**` history (strategy-log, migration-review/README) — left untouched
  per the program "leave history" decision.
