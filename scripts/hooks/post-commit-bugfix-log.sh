#!/usr/bin/env bash
# PostToolUse(Bash) — Auto-log bugfix commits to docs/context/bugfix-log.md
#
# Fires after every Bash tool call. Only acts when:
#   1. Command contains "git commit"
#   2. Latest commit message starts with "fix:" or "fix("
#
# Appends a stub entry with timestamp, hash, message, and files.
# Root cause analysis is deferred to /athena:save enrichment.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only fire on git commit commands
[[ "$COMMAND" == *"git commit"* ]] || exit 0

# Check if latest commit is a fix
MSG=$(git log -1 --format='%s' 2>/dev/null || echo "")
[[ "$MSG" == fix:* ]] || [[ "$MSG" == fix\(* ]] || exit 0

# Extract metadata
HASH=$(git log -1 --format='%h')
TS=$(git log -1 --format='%aI')
FILES=$(git log -1 --format='' --name-only 2>/dev/null | head -10 | tr '\n' ', ' | sed 's/,$//')

LOG_FILE="docs/context/bugfix-log.md"

# Idempotency — skip if this hash is already logged
if [ -f "$LOG_FILE" ] && grep -q "$HASH" "$LOG_FILE" 2>/dev/null; then
  exit 0
fi

# Ensure directory exists and create file with header if needed
mkdir -p docs/context 2>/dev/null
if [ ! -f "$LOG_FILE" ]; then
  cat > "$LOG_FILE" << 'HEADER'
# Bugfix History Log

> Auto-appended by PostToolUse hook on `fix:` commits.
> Root cause and test fields are enriched during `/athena:save`.

---
HEADER
fi

# Append entry
cat >> "$LOG_FILE" << ENTRY

## ${TS} — ${HASH}
**Message:** ${MSG}
**Files:** ${FILES}
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_
ENTRY

echo "Bugfix logged to ${LOG_FILE} — enrich root cause during /athena:save"
