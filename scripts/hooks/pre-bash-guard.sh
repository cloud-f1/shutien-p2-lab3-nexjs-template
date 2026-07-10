#!/bin/bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
if [ -z "$CMD" ]; then
  echo "Warning: pre-bash-guard could not parse command from input"
  exit 0
fi
# Destructive SQL — block only when paired with a DB-execution context (psql/sqlite3/etc.),
# NOT a mere text mention (grep/echo/cat reviewing a migration). Bypass: ALLOW_RAW_SQL=1.
if echo "$CMD" | grep -qiE "DROP TABLE|TRUNCATE|DELETE FROM.*1=1"; then
  if [ "${ALLOW_RAW_SQL:-}" != "1" ] && echo "$CMD" | grep -qiE "\b(psql|sqlite3|mysql|mariadb)\b|--command|--execute"; then
    echo "BLOCKED: Use Drizzle migrations (pnpm db:generate / db:migrate) for schema changes (set ALLOW_RAW_SQL=1 for a genuine raw DB op)." >&2; exit 2;
  fi
fi
# git push guards: block pushes straight to main (any form — plain, --force/-f, or
# explicit refspec origin HEAD:main) so production pushes always go through /athena:deploy.
echo "$CMD" | grep -qE "git push\s+(--[a-z-]+(\s+\S+)?\s+)*origin\s+main(\s|$)" && { echo "BLOCKED: Use /athena:deploy for production pushes." >&2; exit 2; }
echo "$CMD" | grep -qE "git push\s+.*origin\s+HEAD:main(\s|$)"                  && { echo "BLOCKED: Use /athena:deploy for production pushes." >&2; exit 2; }
echo "$CMD" | grep -qE "git push\s+.*(--force|--force-with-lease|-f)\b"        && echo "$CMD" | grep -qE "\bmain\b" && { echo "BLOCKED: force-push near main is not allowed. Use /athena:deploy for production pushes." >&2; exit 2; }
echo "$CMD" | grep -qE "rm\s+-rf\s+/"                          && { echo "BLOCKED: Dangerous rm -rf with absolute path." >&2; exit 2; }
echo "$CMD" | grep -qiE "mkdir.*(backend|frontend)/"            && { echo "BLOCKED: Code lives under next-app/ — never backend/ or frontend/." >&2; exit 2; }

exit 0
