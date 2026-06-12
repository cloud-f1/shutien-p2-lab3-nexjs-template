#!/usr/bin/env bash
# Parse structlog JSON logs and calculate error budget consumption
set -euo pipefail

LOG_FILE="${1:?Usage: check-error-budget.sh <logfile> [--slo 99.5]}"
SLO="${3:-99.5}"

echo "=== Error Budget Report ==="
echo "Log file: ${LOG_FILE}"
echo "SLO target: ${SLO}%"
echo ""

if [ ! -f "$LOG_FILE" ]; then
    echo "Log file not found: ${LOG_FILE}"
    exit 1
fi

# Count total requests and 5xx errors from structlog JSON
# structlog outputs JSON with "status_code" field from request_logging middleware
TOTAL=$(grep -c '"event":"request_completed"' "$LOG_FILE" 2>/dev/null || true)
TOTAL="${TOTAL:-0}"
TOTAL=$(echo "$TOTAL" | tr -d '[:space:]')
ERRORS=$(grep '"event":"request_completed"' "$LOG_FILE" 2>/dev/null | grep -cE '"status_code":\s*5[0-9]{2}' 2>/dev/null || true)
ERRORS="${ERRORS:-0}"
ERRORS=$(echo "$ERRORS" | tr -d '[:space:]')

if [ "$TOTAL" -eq 0 ]; then
    echo "No requests found in log file"
    echo "Success rate: N/A (no data)"
    exit 0
fi

# Calculate success rate
SUCCESS=$((TOTAL - ERRORS))
# Use awk for floating point math
RATE=$(awk "BEGIN { printf \"%.2f\", ($SUCCESS / $TOTAL) * 100 }")
BUDGET_REMAINING=$(awk "BEGIN { printf \"%.2f\", $RATE - $SLO }")
ERROR_RATE=$(awk "BEGIN { printf \"%.3f\", ($ERRORS / $TOTAL) * 100 }")

echo "Total requests: ${TOTAL}"
echo "5xx errors: ${ERRORS}"
echo "Error rate: ${ERROR_RATE}%"
echo "Success rate: ${RATE}%"
echo ""

# Check against SLO
OVER=$(awk "BEGIN { print ($RATE >= $SLO) ? 1 : 0 }")
if [ "$OVER" -eq 1 ]; then
    echo "Within SLO — budget remaining: ${BUDGET_REMAINING}%"
else
    echo "SLO VIOLATED — ${RATE}% < ${SLO}%"
    echo "   Error budget exhausted. Freeze feature work and fix reliability."
    exit 1
fi
