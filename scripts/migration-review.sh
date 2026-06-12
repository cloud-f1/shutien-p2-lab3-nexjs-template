#!/usr/bin/env bash
# scripts/migration-review.sh — Emit offline SQL for an alembic migration
# revision and scan it for red flags. Does not touch any DB.
#
# Usage: scripts/migration-review.sh [revision]
#   revision defaults to `head`.
#
# Outputs:
#   docs/context/migration-review/<rev>-<ts>-upgrade.sql
#   docs/context/migration-review/<rev>-<ts>-downgrade.sql
#
# Red flags (printed to stderr): DROP COLUMN, DROP TABLE, DROP INDEX,
# ALTER COLUMN ... TYPE. Presence of any red flag requires an @dba
# signoff artifact (docs/context/migration-review/<rev>-signoff.md).

set -euo pipefail

rev="${1:-head}"

# Locate repo root so the script can be invoked from anywhere.
repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
out_dir="$repo_root/docs/context/migration-review"
mkdir -p "$out_dir"

stamp=$(date +%Y%m%d-%H%M%S)
up_sql="$out_dir/${rev}-${stamp}-upgrade.sql"
down_sql="$out_dir/${rev}-${stamp}-downgrade.sql"

cd "$repo_root/server"

# Emit upgrade SQL for the requested revision.
uv run python -m alembic upgrade "$rev" --sql > "$up_sql"

# Emit downgrade SQL for a one-step rollback. Non-fatal: some first-ever
# revisions cannot downgrade below base — keep the empty file so the
# Stop-verifier can see both artifacts.
if ! uv run python -m alembic downgrade -1 --sql > "$down_sql" 2>/dev/null; then
  echo "Note: alembic downgrade -1 could not be emitted (likely base revision); wrote empty file." >&2
  : > "$down_sql"
fi

echo "Upgrade SQL:   $up_sql"
echo "Downgrade SQL: $down_sql"

# Red flag scan — grep -E on the generated SQL.
red_flags=(
  "DROP COLUMN"
  "DROP TABLE"
  "DROP INDEX"
  "ALTER COLUMN.*TYPE"
)

flag_count=0
for pat in "${red_flags[@]}"; do
  if grep -qE "$pat" "$up_sql" 2>/dev/null; then
    echo "Red flag in upgrade SQL: $pat" >&2
    flag_count=$((flag_count + 1))
  fi
done

if [ "$flag_count" -gt 0 ]; then
  echo "" >&2
  echo "$flag_count red flag(s) detected — @dba signoff required." >&2
  echo "Next: spawn @dba, produce docs/context/migration-review/${rev}-signoff.md" >&2
fi

exit 0
