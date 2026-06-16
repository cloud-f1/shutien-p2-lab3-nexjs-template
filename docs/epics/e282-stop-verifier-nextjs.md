# E282 — Stop-verifier + hooks rewrite for Next.js

> Phase 66 (AI-dev trust) · hooks · branch `feat/E282-stop-verifier-nextjs`
> Source: the 2026-06 Athena-namespace audit. E277 reconceived the agents/commands
> but **left the hooks layer stale** — the Stop gate enforced nothing on `next-app/`.

## Problem

`scripts/hooks/stop-verifier.sh` is the Stop gate the whole AI-dev loop relies on, but
**every per-file rule targeted `client/`, `server/`, `*.py`** — `grep next-app stop-verifier.sh`
returned zero matches. The verifier passed everything because nothing it checked exists.
The advertised CLAUDE.md invariants (no `console.log`, no inline `style=` colours, shadcn-only
`components/ui/`) were **not enforced**. Rules 6/19/20 referenced deleted FastAPI/Alembic/
schemathesis paths (Rule 20 would hard-block an `openapi.yaml` edit with an un-followable fix);
`post-spec-openapi-lint.sh` was inert; `scripts/hooks/CLAUDE.md` (49KB) still documented the
FastAPI/Vite hook system; `@dba`'s designated doc didn't exist.

## Solution

Rewrite the hooks layer to enforce the real Next.js invariants.

**`stop-verifier.sh` — new 8-rule set (was 23):**
- **Rule 1** (per-file, block): no inline `style=` colour overrides in `next-app/{app,components}/**.tsx` (excl. generated `components/ui/`).
- **Rule 2** (per-file, block): a mutating Server Action (`next-app/actions/*.ts` using `db.insert/update/delete`) must call `requireAuth/Editor/Admin` (defense-in-depth — Server Actions are public POSTs).
- **Rule 3** (per-file, warn): no raw `<table>` in `next-app/app` pages — use `<DataTable>`.
- **Rule 4** (global, block): no `console.log` in next-app runtime code (excl. tests + the `lib/registry`/`lib/openapi` CLI tooling).
- **Rule 5** (global, warn): no new hand-authored files under `next-app/components/ui/`.
- **Rule 6** (global, warn): large file > 500 lines.
- **Rule 18** (global, block): QA gate — UNCHANGED (canary depends on it).
- **Rule 23** (global, block): verification discipline — UNCHANGED.
- Deleted the dead client/server/MSW/pytest/OpenAPI/alembic/routeMap/styles-common rules (old 1-7, 9-17, 19-22). Added a `CHANGED_OVERRIDE` test-injection hook.

**Companion cleanup:**
- Deleted `scripts/hooks/post-spec-openapi-lint.sh` (inert; @spec-writer no longer edits OpenAPI).
- Swapped the obsolete `test-rule-21-22-design-system.sh` fixture for `test-rule-nextjs-invariants.sh` (proves Rules 1/2/4 block on violations + pass when clean).
- Refreshed `scripts/hooks/CLAUDE.md` (8-rule table, hook registry, removed dead E193 OpenAPI subsection, de-staled examples).
- Updated `rule-to-lesson.json` to the new rule IDs.
- Created `docs/context/dba-migrations.md` (`@dba`'s designated doc); rewrote `docs/context/migration-review/README.md` to the Drizzle flow; deleted 2 stale alembic SQL artifacts.

## Key Files

- `scripts/hooks/stop-verifier.sh`, `scripts/hooks/tests/test-rule-nextjs-invariants.sh`
- `scripts/hooks/CLAUDE.md`, `scripts/hooks/rule-to-lesson.json`
- `docs/context/dba-migrations.md`, `docs/context/migration-review/README.md`

## Acceptance Criteria

- [x] `stop-verifier.sh` rules fire on `next-app/` (per-file Rules 1-3 + global 4-6).
- [x] `make guard-selftest` green: canary 19/0 + Rule 18 + Rule 23 fixtures + new Next.js fixture 5/0.
- [x] A clean changeset exits 0 (no spurious block — CLI tooling excluded from Rule 4).
- [x] No dead FastAPI/Vite/OpenAPI/alembic references remain in the verifier or its doc.

## Out of Scope

- `/athena:domain` scaffold fix → **E283**.
- `post-edit-lint.sh` still auto-formats `*.py` (harmless no-op; left for a later pass).
