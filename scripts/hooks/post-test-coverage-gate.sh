#!/bin/bash
# Enforces 80% coverage gate after pytest or vitest runs.
# Used as a PostToolUse(Bash) hook scoped to @qa agent.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
OUTPUT=$(echo "$INPUT" | jq -r '.tool_result.stdout // empty' 2>/dev/null)

# Only check coverage-related commands
echo "$CMD" | grep -qE "(pytest.*--cov|vitest.*--coverage|pnpm.*test.*coverage)" || exit 0

# Parse coverage percentage from pytest output (e.g. "TOTAL    500    80    84%")
COVERAGE=$(echo "$OUTPUT" | grep -E '^TOTAL' | grep -oE '[0-9]+%' | tail -1 | tr -d '%')
if [ -z "$COVERAGE" ]; then
  # Try vitest format: "All files | XX.XX"
  COVERAGE=$(echo "$OUTPUT" | grep -E "All files" | grep -oE '[0-9]+\.[0-9]+' | head -1 | cut -d. -f1)
fi

if [ -n "$COVERAGE" ] && [ "$COVERAGE" -lt 80 ]; then
  echo "COVERAGE GATE: ${COVERAGE}% < 80% minimum. Add tests before proceeding." >&2
  exit 0  # Non-blocking warning — the agent sees the message
fi
exit 0
