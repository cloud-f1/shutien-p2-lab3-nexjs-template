#!/bin/bash
# Backs up file before @debugger edits it, so changes can be compared/reverted.
# Used as a PreToolUse(Edit|Write) hook scoped to @debugger agent.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  BACKUP_DIR=".claude/debug-backups"
  mkdir -p "$BACKUP_DIR"
  BASENAME=$(basename "$FILE")
  TS=$(date +%Y%m%d_%H%M%S)
  cp "$FILE" "$BACKUP_DIR/${BASENAME}.${TS}.bak"
fi
exit 0
