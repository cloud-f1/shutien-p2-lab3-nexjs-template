# E283 — Fix `/athena:domain` scaffold (copy-from-items generator)

> Phase 66 (AI-dev trust) · tooling · branch `feat/E283-domain-scaffold`
> Source: the 2026-06 Athena-namespace audit (F2).

## Problem

`/athena:domain` — the one command users invoke to scaffold a new domain — called
`scripts/new-domain.sh` at its core step, but **E280 deleted that script** (it was the
old FastAPI generator) and never replaced it. `make new-domain` only echoed "use
/athena:domain". So both entry points dead-ended: the scaffold was non-functional.

## Solution

Restore `scripts/new-domain.sh` as a real **copy-from-`items`** Next.js generator.

`scripts/new-domain.sh <singular> [plural]` copies the canonical `items` domain and
renames every identifier/path (singular/plural/Pascal variants derived from the input;
explicit plural optional), producing a domain that **typechecks, lints, and tests clean
out of the box**:
- `lib/schema/<plural>.ts` (Drizzle `pgTable`, `title` starter column)
- `lib/validations/<plural>.ts` + `<plural>.test.ts` (Zod + a db-free Vitest test)
- `actions/<plural>.ts` (`requireEditor`-guarded, ownership-scoped Server Actions)
- `app/(dashboard)/dashboard/<plural>/{page,_<sg>-dialog,_<sg>-form,_<pl>-table}.tsx`
- appends `export * from "./<plural>"` to the schema barrel

It refuses to overwrite an existing domain and prints the next steps (`pnpm db:generate
&& pnpm db:migrate`, nav link, verify). Renames use **`perl`** (portable `\b` word
boundaries — BSD/macOS `sed` doesn't support `\b`), with import-path renames
(`@/actions/items`, `@/lib/validations/items`) and the bare `Item` type rename run last.

`make new-domain NAME=<singular> [PLURAL=<plural>]` now runs the script; `.claude/commands/athena/domain.md`
Step 2/3 updated to describe the real (now-accurate) behaviour and drop the stale
"the script predates the migration / delete its server output" caveats.

## Key Files

- `scripts/new-domain.sh` (restored), `.claude/commands/athena/domain.md`, `Makefile`

## Acceptance Criteria

- [x] `scripts/new-domain.sh <name>` + `make new-domain NAME=<name>` generate a domain that
      passes `pnpm typecheck`, `pnpm lint`, and the generated `pnpm vitest` test (verified with
      throwaway `widget`/`gadget` names, then reverted).
- [x] The generator refuses to overwrite an existing domain.
- [x] `domain.md` describes the real script (no stale FastAPI/Vite caveats).

## Out of Scope

- Multi-column/field scaffolding beyond the starter `title` column (the doc tells the
  author to customise the table + Zod + form together).
- `docs/templates/domain/nextjs/*.tmpl` (the doc anchors to the live `items` domain as the
  template, which is more maintainable than a parallel `.tmpl` tree).
