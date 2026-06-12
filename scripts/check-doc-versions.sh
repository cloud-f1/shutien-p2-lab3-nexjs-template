#!/usr/bin/env bash
# Check for stale version references in documentation.
# Run: bash scripts/check-doc-versions.sh
# Exit 0 = clean, Exit 1 = stale references found.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0

echo "Checking for stale version references in docs..."
echo ""

# Node 20 references (should be 22)
STALE_NODE=$(grep -rn --include="*.md" -E "Node.*20\+|nvm install 20|node.*>= 20|node.*>=20|\[e\.g\., 20\.x\]" "$ROOT" \
  | grep -v "node_modules" \
  | grep -v "docs/epics/" \
  | grep -v "docs/context/strategy-log" \
  | grep -v "CHANGELOG" \
  | grep -v "/dist/" || true)

if [ -n "$STALE_NODE" ]; then
  echo "FAIL: Stale Node 20 references found (should be 22):"
  echo "$STALE_NODE"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

# pnpm 8 references (should be 9 if we standardize on 9)
STALE_PNPM=$(grep -rn --include="*.md" -E "pnpm.*>= 8|pnpm.*>=8|pnpm 8\+" "$ROOT" \
  | grep -v "node_modules" \
  | grep -v "docs/epics/" \
  | grep -v "docs/context/strategy-log" \
  | grep -v "CHANGELOG" \
  | grep -v "/dist/" || true)

if [ -n "$STALE_PNPM" ]; then
  echo "WARN: pnpm 8 references found (check if should be 9):"
  echo "$STALE_PNPM"
  echo ""
fi

if [ "$ERRORS" -eq 0 ]; then
  echo "All version references are consistent."
  exit 0
else
  echo "Found $ERRORS version inconsistency issue(s). Please fix the files above."
  exit 1
fi
