#!/bin/bash
# Audit log — append every bash command as JSONL to .claude/audit.jsonl
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_result.exit_code // "unknown"' 2>/dev/null)
[ -z "$CMD" ] && CMD="(parse error)"

# Agent attribution
AGENT="${CLAUDE_AGENT:-unknown}"

# Epic ID from branch name (matches feat/E82-slug or E82)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
EPIC=$(echo "$BRANCH" | sed -n 's/.*\(E[0-9]\{1,\}\).*/\1/p')
[ -z "$EPIC" ] && EPIC="none"

# Duration (if available from hook input)
DURATION_MS=$(echo "$INPUT" | jq -r '.tool_result.duration_ms // 0' 2>/dev/null)

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p .claude

# Write JSONL line
jq -n -c \
  --arg ts "$TS" \
  --arg event "bash" \
  --arg cmd "$CMD" \
  --argjson exit "${EXIT_CODE:-0}" \
  --arg agent "$AGENT" \
  --arg epic "$EPIC" \
  --argjson duration_ms "${DURATION_MS:-0}" \
  '{ts:$ts,event:$event,cmd:$cmd,exit:$exit,agent:$agent,epic:$epic,duration_ms:$duration_ms}' \
  >> .claude/audit.jsonl

exit 0
