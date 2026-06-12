# E157 — Alembic Migration Review Gate

> Phase 40 — Self-Review Improvements | Size: S (3 SP) | Deps: none
> Source: self-review 2026-04-24 — `alembic --autogenerate` blind spots are a production incident source

## Problem

`alembic revision --autogenerate` is known to silently miss:

- Column rename (sees it as drop + add → data loss)
- Index rename
- Enum value add/remove
- `CheckConstraint` changes
- Partial / expression indexes
- `server_default` expression changes
- PostgreSQL-only types when comparing against SQLite dev DB

Today the pipeline has `alembic upgrade head` running in production startup (`server/start.sh`), but **no human or machine reviews the generated SQL before it hits prod**. Each migration is a live-fire test.

E81 hardened `alembic env.py` (compare_type, compare_server_default) but did not add a review gate.

## Solution

Make migration review a **mandatory @qa Phase 2.6** that auto-runs when `server/alembic/versions/` files changed in the PR. Same principle as E156: @qa is the quality authority, migration safety is a quality concern.

1. `@qa` detects migration files changed → auto-invoke `scripts/migration-review.sh`
2. Script emits upgrade + downgrade SQL, scans red flags, saves artifacts to `docs/context/migration-review/`
3. On red flag (DROP COLUMN / ALTER TYPE / missing downgrade) → `@qa` **auto-delegates to @dba** for a full review + sign-off
4. @dba's sign-off writes to `docs/context/migration-review/<rev>-signoff.md` with the reviewer's name + red-flag decisions
5. Stop-verifier Rule #19 refuses commit without sign-off artifact
6. Pre-deploy gate (secondary defense) re-runs SQL emit to confirm no drift since @qa ran

## Key Files

| File | Action |
|------|--------|
| `scripts/migration-review.sh` | New — emits SQL + scans red flags |
| `.claude/agents/qa.md` | **Major edit** — add Phase 2.6 "Migration Safety" (auto-triggered on alembic changes, delegates to @dba on red flag) |
| `.claude/agents/dba.md` | Edit — formalize "Migration Review Sign-off" output format |
| `.claude/commands/athena/dba.md` | Edit — add `review <rev>` sub-command for ad-hoc review |
| `scripts/hooks/pre-deploy-guard.sh` | Edit — secondary Gate: "migration SQL matches pre-QA emit" |
| `scripts/hooks/stop-verifier.sh` | Edit — Rule #19 requires `<rev>-signoff.md` present |
| `docs/context/migration-review/.gitkeep` | New |
| `docs/context/migration-review/README.md` | New — red flags + sign-off template |

## Implementation

### migration-review.sh

```bash
#!/usr/bin/env bash
# Usage: scripts/migration-review.sh [revision]
# Generates offline SQL for review; does not touch any DB.
set -euo pipefail
cd server

rev="${1:-head}"
out_dir="../docs/context/migration-review"
mkdir -p "$out_dir"

stamp=$(date +%Y%m%d-%H%M%S)
up_sql="$out_dir/${rev}-${stamp}-upgrade.sql"
down_sql="$out_dir/${rev}-${stamp}-downgrade.sql"

uv run alembic upgrade "$rev" --sql > "$up_sql"
uv run alembic downgrade -1 --sql > "$down_sql"

echo "Upgrade SQL:   $up_sql"
echo "Downgrade SQL: $down_sql"

# Red flag scan
red_flags=(
  "DROP COLUMN"
  "DROP TABLE"
  "DROP INDEX"
  "ALTER COLUMN.*TYPE"  # type change
)
for pat in "${red_flags[@]}"; do
  if grep -qE "$pat" "$up_sql"; then
    echo "⚠️  Red flag in upgrade SQL: $pat" >&2
  fi
done
```

### Rule #19 (stop-verifier)

```bash
rule_19_migration_review() {
  local branch; branch=$(git branch --show-current 2>/dev/null) || return 0
  [[ "$branch" =~ ^feat/e[0-9]+ ]] || return 0

  local added_migration
  added_migration=$(git diff --name-only origin/main...HEAD -- 'server/alembic/versions/*.py' | head -1)
  [[ -n "$added_migration" ]] || return 0

  local rev; rev=$(basename "$added_migration" .py | cut -d_ -f1)
  if ! compgen -G "docs/context/migration-review/${rev}-*-upgrade.sql" > /dev/null; then
    echo "Rule 19: alembic migration $rev added but no review SQL in docs/context/migration-review/" >&2
    echo "  Run: scripts/migration-review.sh $rev" >&2
    return 1
  fi
}
```

### @qa Phase 2.6 auto-trigger

```
Phase 2.6 — Migration Safety (auto-triggered when `git diff origin/main...HEAD -- 'server/alembic/versions/*.py'` is non-empty)

  1. Run scripts/migration-review.sh <rev>
  2. If red flags found → SPAWN @dba subagent with:
     - SQL artifact paths
     - red-flag summary
     - requirement: produce docs/context/migration-review/<rev>-signoff.md
  3. Wait for @dba signoff (or NOGO)
  4. On NOGO → FAIL @qa with @dba's reasoning
  5. On GO → commit the *.sql + *-signoff.md artifacts as part of QA output
```

### @dba sign-off output format

```markdown
# Migration Review — <rev>

- Reviewed: <date>
- Reviewer: @dba
- Artifacts: upgrade.sql, downgrade.sql

## Red flags observed
- [ ] DROP COLUMN on `<table>.<col>` — decision: accepted (column unused for 30+ days, verified via git log)
- [ ] ALTER COLUMN TYPE — decision: rejected, requires pt-osc / multi-step migration

## Decision
**GO** / **NOGO**

## Rollback plan
<SQL or procedural steps for undoing this migration in production>
```

## Alignment / Cross-Epic Hooks

- **Writes to**: `docs/context/migration-review/<rev>-signoff.md`, `.claude/audit.jsonl` event `qa_migration`
- **Enforces on**: E161's `user_sessions` table migration — must get @dba signoff before E161 can merge
- **Downstream of**: (none — E157 is a root capability)
- **Bumps**: Stop-verifier rule count — adds Rule #19 (migration requires signoff artifact). Combined with E156's Rule #20, after Phase 40 count = 20.
- **CLAUDE.md**: update rule count line to reflect new total
- **Phase 40 siblings**: runs after E156 in @qa execution order (Phase 2.5 → Phase 2.6)

## Acceptance Criteria

- [ ] `scripts/migration-review.sh` generates upgrade + downgrade SQL into `docs/context/migration-review/`
- [ ] Red-flag scan prints warnings for `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN ... TYPE`
- [ ] Stop-verifier Rule #19 blocks Stop if migration added without review SQL
- [ ] `@dba` agent spec documents the review checklist
- [ ] `docs/context/migration-review/README.md` explains red flags + sign-off
- [ ] CLAUDE.md Stop-verifier rule count updated to reflect Rule #19 addition (combined with E156's Rule #20, Phase 40 total: 20 rules)

## Out of Scope

- Automated "is this migration safe under concurrent writes" detection (needs pgspy / pt-osc)
- Production data backfill plan (one epic per risky migration)
