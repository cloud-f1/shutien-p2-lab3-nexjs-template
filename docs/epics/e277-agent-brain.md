# E277 — Agent brain reconceive (FastAPI → Next.js)

> Phase 65 · agent/command de-stale · branch `feat/E277-agent-brain`
> Source: the 2026-06 FastAPI-doc audit. The Athena agent + command definitions
> still described the removed FastAPI + Vite stack (OpenAPI, SQLAlchemy, Alembic,
> pytest, Pydantic, MSW, `server/app`, `client/src`). Following them produced
> wrong instructions for this Next.js app.

## Problem

The `.claude/agents/*` and `.claude/commands/athena/*` definitions are the "brain"
that drives every Athena agent/command. After the Next.js migration they pointed
at a stack that no longer exists:
- `/athena:dba` managed **Alembic** Python revisions (`uv run alembic`, `test_migration_lint.py`).
- `/athena:audit` did a three-source **OpenAPI ↔ FastAPI routes ↔ Axios client** drift check.
- `@dba` was a SQLAlchemy/Alembic DBA referencing the removed `dba-migrations` skill.
- `@qa`/`@reviewer`/`@debugger`/`@spec-writer`/`@deployer`/`@designer`/`@strategist`/`@orchestrator`
  and the `design`/`domain`/`qa`/`qa-report`/`batch`/`learn`/`spec` commands referenced
  pytest/schemathesis/redocly/MSW/`server/app`/`client/src`/`routeMap.ts`/`App.tsx`.

## Solution

Reconceive the two headline commands and de-stale the rest to the real stack
(Next.js 16 + Drizzle/drizzle-kit + Zod + Auth.js + Vitest/Playwright):

- **`/athena:dba` → drizzle-kit migration management.** Subcommands rewritten for
  plain-`.sql` migrations in `drizzle/migrations/` + `meta/_journal.json`:
  `inspect`/`lint` (`pnpm db:test-migrate` fresh-DB apply), `history` (journal chain),
  `diagnose` (PG 42804 USING cast, in-place enum recreate, missing journal entry),
  `status` (`npx drizzle-kit check` drift), `new` (`pnpm db:generate`), `review`
  (read the `.sql`, scan red flags, delegate to `@dba`). Reference: `nextjs-saas-patterns` §5.
- **`/athena:audit` → schema/validation/surface drift.** Three sources are now the
  Drizzle schema (`lib/schema/*`), the shared Zod validation (`lib/validations/*`),
  and the surfaces (`actions/*.ts`, `app/api/**/route.ts`, UI forms). New drift checks:
  unvalidated input, orphan validation, **enum drift** (pgEnum vs Zod allowlist vs TS
  union), **RBAC gap** (mutating Server Action with no `requireAuth/Editor/Admin` guard),
  untested surface.
- **`@dba`** reconceived for Drizzle/postgres-js; sign-off template/cheatsheet updated
  (Drizzle has no auto-downgrade → reverse SQL hand-authored); points at `nextjs-saas-patterns` §5.
- **De-staled** `@qa`, `@reviewer`, `@debugger`, `@spec-writer`, `@deployer`, `@designer`,
  `@strategist`, `@orchestrator` + the `design`, `domain`, `qa`, `qa-report`, `batch`,
  `learn`, `spec` commands — every stale-stack reference swapped for the Next.js
  equivalent (gates run from `next-app/`: `pnpm typecheck && pnpm lint && pnpm test`
  (+`build`), coverage `pnpm test:coverage`, e2e `pnpm test:e2e`).

## Key Files

- `.claude/commands/athena/{dba,audit,design,domain,qa,qa-report,batch,learn,spec}.md`
- `.claude/agents/{dba,qa,reviewer,debugger,spec-writer,deployer,designer,strategist,orchestrator}.md`

## Acceptance Criteria

- [x] No **live** stale-stack reference remains in `.claude/agents` or
      `.claude/commands/athena` (grep clean except intentional "the old X was removed" negations).
- [x] `/athena:dba` and `/athena:audit` describe the real Drizzle/Zod/Next.js surfaces and commands.
- [x] All edited files keep valid YAML frontmatter (commands/agents still load).

## Out of Scope

- Fixing `scripts/new-domain.sh` (still the old FastAPI generator) and the missing
  `docs/templates/domain/nextjs/*.tmpl` → **E280** (stale scripts/config). `domain.md`
  was anchored to the canonical `items` domain pattern in the meantime.
- The physical `scripts/migration-review.sh` / `post-spec-openapi-lint.sh` files
  (now unreferenced) → **E280**.
