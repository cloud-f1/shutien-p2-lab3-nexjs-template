#!/bin/bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
[ -z "$FILE" ] && exit 0
[ -f "$FILE" ] || exit 0

if [[ "$FILE" == *.py ]] && command -v ruff >/dev/null 2>&1; then
  ruff check --fix "$FILE" 2>&1 || echo "Warning: ruff check failed on $FILE"
  ruff format "$FILE" 2>&1 || echo "Warning: ruff format failed on $FILE"
fi
if [[ "$FILE" == *.ts* ]] && command -v npx >/dev/null 2>&1; then
  npx prettier --write "$FILE" 2>&1 || echo "Warning: prettier failed on $FILE"
fi
exit 0
