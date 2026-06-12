#!/bin/bash
# Logs verification result after @debugger runs a bash command.
# Used as a PostToolUse(Bash) hook scoped to @debugger agent.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_result.exit_code // "unknown"' 2>/dev/null)
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

LOG_FILE="docs/context/debug-log.md"
mkdir -p docs/context

if [ "$EXIT_CODE" = "0" ]; then
  echo "<!-- [$TS] VERIFY PASS: $CMD -->" >> "$LOG_FILE"
else
  echo "<!-- [$TS] VERIFY FAIL (exit=$EXIT_CODE): $CMD -->" >> "$LOG_FILE"
fi
exit 0
