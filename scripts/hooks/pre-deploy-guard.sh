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
DIRTY=$(git status --porcelain 2>/dev/null)
if [ -n "$DIRTY" ]; then
  DIRTY_LIST=$(echo "$DIRTY" | head -10 | sed 's/^/    /')
  ERRORS="${ERRORS}\nGate 5 FAIL: uncommitted changes — commit or stash first:\n${DIRTY_LIST}"
  # Hook-written context docs are a known noise source: if that is ALL that is
  # dirty, `git checkout -- docs/context` clears it. Anything else needs a real
  # decision, so only say this when nothing outside docs/context/ is dirty.
  if [ -z "$(echo "$DIRTY" | grep -v 'docs/context/')" ]; then
    ERRORS="${ERRORS}\n  (only docs/context/* is dirty — likely hook write-back noise; inspect with 'git diff docs/context', then commit it or 'git checkout -- docs/context')"
  fi
fi

# Gate 6: Correct branch (fast check)
BRANCH=$(git branch --show-current 2>/dev/null)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "develop" ]; then
  ERRORS="${ERRORS}\nGate 6 FAIL: branch '$BRANCH' is not main or develop"
fi

# Gates 7 / 7b (OpenAPI schemathesis conformance + Alembic migration-SQL emit)
# were removed with the FastAPI stack. Migration safety is now enforced by
# `pnpm db:test-migrate` (fresh-DB apply) + `npx drizzle-kit check` in @qa /
# @deployer; there is no OpenAPI contract to sweep. The heavy gates (typecheck,
# lint, test, build, db:test-migrate) run in the @deployer agent, not this hook.

if [ -n "$ERRORS" ]; then
  echo -e "DEPLOY BLOCKED (pre-check):$ERRORS" >&2
  echo "Run the full 7-gate check via @deployer before deploying." >&2
  exit 2
fi
exit 0
