#!/bin/bash
# Runs on every user prompt. Detects write-back requests and injects
# the agent's designated doc path as additionalContext.
# stdout → added as additionalContext to Claude's session.
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null | tr '[:upper:]' '[:lower:]')

# Detect write-back phrases (see docs/techstack/agent-teams.md for full list)
if echo "$PROMPT" | grep -qE "(update|write|save|checkpoint).*(doc|memory|context|file|log)|write.?back"; then
  echo "=== WRITE-BACK REQUESTED ==="
  echo "Agent document targets:"
  echo "  @spec-writer     → docs/context/spec-log.md"
  echo "  @qa              → docs/context/review-log.md + docs/context/test-status.md"
  echo "  @best-practice   → docs/context/decisions.md + TECHSTACK.md §12"
  echo "  @debugger        → docs/context/debug-log.md (tag [GENERALIZABLE] if applicable)"
  echo "  @deployer        → docs/context/deploy-log.md"
  echo "  @memory-curator  → ~/.claude/template-memory/"
  echo "If addressed to one agent: write that doc only."
  echo "If general: run /athena:save for all agents."
  exit 0
fi
exit 0
