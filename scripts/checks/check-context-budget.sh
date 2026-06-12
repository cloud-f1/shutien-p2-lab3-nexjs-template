#!/usr/bin/env bash
# Check context document sizes against budget
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MAX_TOTAL=2000
MAX_SINGLE=200
MAX_SESSION_SUMMARY=300
CONTEXT_DIR="$PROJECT_ROOT/docs/context"
EXIT_CODE=0

# Count total lines
TOTAL=$(wc -l "$CONTEXT_DIR"/*.md 2>/dev/null | tail -1 | awk '{print $1}')

echo "=== Context Budget Check ==="
echo ""

# Check total
if [ "$TOTAL" -gt "$MAX_TOTAL" ]; then
    echo "OVER BUDGET: $TOTAL / $MAX_TOTAL total lines"
    EXIT_CODE=1
else
    echo "Total: $TOTAL / $MAX_TOTAL lines — OK"
fi

# Check individual files
echo ""
for f in "$CONTEXT_DIR"/*.md; do
    LINES=$(wc -l < "$f")
    FNAME=$(basename "$f")
    LIMIT=$MAX_SINGLE
    [ "$FNAME" = "session-summary.md" ] && LIMIT=$MAX_SESSION_SUMMARY
    if [ "$LINES" -gt "$LIMIT" ]; then
        echo "WARNING: $FNAME: $LINES / $LIMIT lines (over budget)"
        EXIT_CODE=1
    fi
done

if [ $EXIT_CODE -eq 0 ]; then
    echo "All files within budget."
fi

exit $EXIT_CODE
