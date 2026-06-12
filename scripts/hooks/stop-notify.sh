#!/bin/bash
# Desktop notification when Claude finishes (macOS)
# Note: this script uses no relative paths, so cwd does not matter.
# osascript is always available at /usr/bin/osascript on macOS.
if command -v osascript >/dev/null 2>&1; then
  osascript -e 'display notification "Claude has finished working." with title "AI-Coding-Template" sound name "Glass"' 2>/dev/null
fi
exit 0
