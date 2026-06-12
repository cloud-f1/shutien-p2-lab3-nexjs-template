#!/bin/bash
# Pre-deploy guard for @deployer agent. Blocks deploy-related bash commands
# if lightweight preconditions fail. Heavy gates (pytest, vitest) are run
# by the deployer agent itself — not in this hook (would timeout).
# Used as a PreToolUse(Bash) hook scoped to @deployer agent.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only enforce on deploy-related commands
echo "$CMD" | grep -qiE "(git push|zeabur|deploy)" || exit 0

ERRORS=""

# Gate 5: Clean working tree (fast check)
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  ERRORS="${ERRORS}\nGate 5 FAIL: uncommitted changes — commit or stash first"
fi

# Gate 6: Correct branch (fast check)
BRANCH=$(git branch --show-current 2>/dev/null)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "develop" ]; then
  ERRORS="${ERRORS}\nGate 6 FAIL: branch '$BRANCH' is not main or develop"
fi

# Gate 7 (E156): OpenAPI contract conformance via schemathesis.
# Defense-in-depth — primary enforcement is @qa Phase 2.5, but we re-run
# the sweep here so a dirty/skipped CI can't deploy spec↔server drift.
# Runs only when the `server/` directory exists (template projects) and
# schemathesis is installed (dev extras present).
if [ -d server ] && command -v uv >/dev/null 2>&1; then
  if (cd server && uv run python -c "import schemathesis" >/dev/null 2>&1); then
    if ! (cd server && uv run pytest tests/contract/test_schemathesis_conformance.py -q --tb=no >/dev/null 2>&1); then
      ERRORS="${ERRORS}\nGate 7 FAIL: schemathesis found spec↔server drift. Run 'cd server && uv run pytest tests/contract/test_schemathesis_conformance.py -v' to see details. Fix docs/openapi.yaml or the handler before deploy (E156)."
    fi
  fi
fi

# Gate 7b (E157): Migration SQL matches pre-QA emit.
# Defense-in-depth for migration safety — primary enforcement is @qa
# Phase 2.6 + Stop verifier Rule #19, but here we re-emit the offline SQL
# for any migration that exists vs origin/main, hash it, and compare
# against the most recent committed `<rev>-*-upgrade.sql` artifact. A
# mismatch means the migration changed since @qa signed off — refuse to
# deploy.
if [ -d server ] && command -v uv >/dev/null 2>&1 && [ -x scripts/migration-review.sh ]; then
  GATE_7B_MIGRATIONS=$(git diff --name-only origin/main...HEAD -- 'server/alembic/versions/*.py' 2>/dev/null)
  if [ -n "$GATE_7B_MIGRATIONS" ]; then
    GATE_7B_TMP=$(mktemp -d 2>/dev/null || mktemp -d -t migrev)
    GATE_7B_FAILS=""
    while IFS= read -r GATE_7B_FILE; do
      [ -z "$GATE_7B_FILE" ] && continue
      GATE_7B_REV=$(basename "$GATE_7B_FILE" .py | cut -d_ -f1)
      [ -z "$GATE_7B_REV" ] && continue
      # Find the most recently committed upgrade.sql artifact for this rev.
      GATE_7B_COMMITTED=$(ls -1t docs/context/migration-review/${GATE_7B_REV}-*-upgrade.sql 2>/dev/null | head -1)
      if [ -z "$GATE_7B_COMMITTED" ]; then
        GATE_7B_FAILS="${GATE_7B_FAILS}\n  - ${GATE_7B_REV}: no committed upgrade.sql artifact"
        continue
      fi
      # Re-emit fresh SQL into a temp dir; we only need the upgrade body.
      GATE_7B_FRESH="${GATE_7B_TMP}/${GATE_7B_REV}-fresh.sql"
      if ! (cd server && uv run alembic upgrade "$GATE_7B_REV" --sql 2>/dev/null) > "$GATE_7B_FRESH"; then
        GATE_7B_FAILS="${GATE_7B_FAILS}\n  - ${GATE_7B_REV}: failed to re-emit offline SQL"
        continue
      fi
      # Hash both files and compare. Use shasum for cross-platform sha256.
      GATE_7B_HASH_NEW=$(shasum -a 256 "$GATE_7B_FRESH" 2>/dev/null | awk '{print $1}')
      GATE_7B_HASH_OLD=$(shasum -a 256 "$GATE_7B_COMMITTED" 2>/dev/null | awk '{print $1}')
      if [ -z "$GATE_7B_HASH_NEW" ] || [ -z "$GATE_7B_HASH_OLD" ] || [ "$GATE_7B_HASH_NEW" != "$GATE_7B_HASH_OLD" ]; then
        GATE_7B_FAILS="${GATE_7B_FAILS}\n  - ${GATE_7B_REV}: SQL drift since @qa (committed=${GATE_7B_HASH_OLD:0:12}, fresh=${GATE_7B_HASH_NEW:0:12})"
      fi
    done <<< "$GATE_7B_MIGRATIONS"
    rm -rf "$GATE_7B_TMP" 2>/dev/null
    if [ -n "$GATE_7B_FAILS" ]; then
      ERRORS="${ERRORS}\nGate 7b FAIL: migration SQL does not match pre-QA emit (E157):${GATE_7B_FAILS}\n  Fix: re-run scripts/migration-review.sh <rev> + re-run @qa Phase 2.6 to refresh artifacts."
    fi
  fi
fi

if [ -n "$ERRORS" ]; then
  echo -e "DEPLOY BLOCKED (pre-check):$ERRORS" >&2
  echo "Run the full 7-gate check via @deployer before deploying." >&2
  exit 2
fi
exit 0
