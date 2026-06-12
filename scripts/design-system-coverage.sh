#!/bin/bash
# Design System Coverage (E176) — measures what % of client pages compose
# primitives from `client/src/components/ui/`.
#
# Counts, for every `client/src/pages/**/*.tsx` (excluding test files), the
# number of import statements that reference `components/ui` (via any of
# the conventional paths: `@/components/ui`, `../../components/ui`,
# `../components/ui`, `~/components/ui`, etc.). A page is "covered" if it
# has >=1 such import.
#
# Output: a per-page table + overall percentage.
# Exit:
#   0 — coverage >= COVERAGE_THRESHOLD (default 80)
#   1 — coverage <  COVERAGE_THRESHOLD (so it can be wired into CI)
#
# Standalone run:
#   bash scripts/design-system-coverage.sh
#
# Override threshold:
#   COVERAGE_THRESHOLD=90 bash scripts/design-system-coverage.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGES_DIR="$REPO_ROOT/client/src/pages"
THRESHOLD="${COVERAGE_THRESHOLD:-80}"

if [ ! -d "$PAGES_DIR" ]; then
  echo "Design System Coverage: no pages directory at $PAGES_DIR" >&2
  exit 0
fi

# Collect all page tsx files (skip __tests__, *.test.tsx, *.spec.tsx).
PAGES=$(find "$PAGES_DIR" -type f -name "*.tsx" \
  ! -path "*/__tests__/*" \
  ! -name "*.test.tsx" \
  ! -name "*.spec.tsx" \
  | sort)

if [ -z "$PAGES" ]; then
  echo "Design System Coverage: no page tsx files found under $PAGES_DIR"
  exit 0
fi

TOTAL=0
COVERED=0
ROWS=""

# Match any import path containing `components/ui` — covers `@/components/ui`,
# `../../components/ui`, `~/components/ui`, etc. We require the literal
# substring `components/ui` inside an import-from string to keep the check
# simple and resistant to alias variations.
while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  TOTAL=$((TOTAL + 1))
  REL=${FILE#"$REPO_ROOT/"}
  # Use `|| true` so set -e doesn't trip when grep finds 0 matches.
  # `grep -c` returns 1 on no matches but we want the count (0).
  COUNT=$(grep -cE "from[[:space:]]+['\"][^'\"]*components/ui[^'\"]*['\"]" "$FILE" 2>/dev/null | head -1 || true)
  COUNT=$(echo "${COUNT:-0}" | tr -d ' \n')
  [ -z "$COUNT" ] && COUNT=0

  if [ "$COUNT" -gt 0 ]; then
    MARK="✅"
    COVERED=$((COVERED + 1))
  else
    MARK="⬜"
  fi
  ROWS="${ROWS}${COUNT}\t${MARK}\t${REL}\n"
done <<< "$PAGES"

PCT=0
if [ "$TOTAL" -gt 0 ]; then
  PCT=$(( (COVERED * 100) / TOTAL ))
fi

echo "=== Design System Coverage (E176) ==="
echo ""
printf "%-7s  %-3s  %s\n" "imports" "ok" "page"
printf "%-7s  %-3s  %s\n" "-------" "---" "----"
echo -e "$ROWS" | awk -F'\t' 'NF>=3 {printf "%-7s  %-3s  %s\n", $1, $2, $3}'
echo ""
echo "Pages composing primitives: $COVERED / $TOTAL  (${PCT}%)"
echo "Threshold: ${THRESHOLD}%"

if [ "$PCT" -ge "$THRESHOLD" ]; then
  echo "Status: PASS"
  exit 0
else
  echo "Status: FAIL — coverage below threshold."
  echo ""
  echo "Fix: have each uncovered page compose at least one primitive from"
  echo "client/src/components/ui/ (e.g. <PageContainer>, <Button>,"
  echo "<DataTable>). See docs/design/design.md."
  exit 1
fi
