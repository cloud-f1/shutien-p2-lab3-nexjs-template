#!/bin/bash
# CSS Variable Drift Guard — detect undefined CSS custom properties.
# Compares definitions (theme/global CSS) against references (component CSS).
# Completes in <2s using grep only (no CSS parser).
#
# Usage:
#   scripts/checks/css-var-check.sh              # report undefined vars
#   scripts/checks/css-var-check.sh --migration   # old-var → suggested replacement table

set -uo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
STYLES_DIR="$ROOT/client/src/styles"
CLIENT_SRC="$ROOT/client/src"

MIGRATION_MODE=false
if [[ "${1:-}" == "--migration" ]]; then
  MIGRATION_MODE=true
fi

# ── 1. Extract all --var-name DEFINITIONS from theme/global CSS ──
# Source files: client/src/styles/*.css and client/src/styles/**/*.css
DEFINITIONS=$(
  find "$STYLES_DIR" -name "*.css" -type f 2>/dev/null |
  xargs grep -ohE -- '--[a-zA-Z][a-zA-Z0-9_-]*' 2>/dev/null |
  sort -u || true
)

# ── 2. Extract all var(--var-name) REFERENCES from component CSS ──
# Component files: all .css files under client/src/ EXCEPT those in styles/
REFERENCES=$(
  find "$CLIENT_SRC" -name "*.css" -type f -not -path "$STYLES_DIR/*" 2>/dev/null |
  xargs grep -ohE 'var\(--[a-zA-Z][a-zA-Z0-9_-]*' 2>/dev/null |
  sed 's/^var(//' |
  sort -u || true
)

# ── 3. Compare: find referenced vars that are never defined ──
UNDEFINED=""
if [[ -n "$REFERENCES" ]]; then
  while IFS= read -r VAR; do
    [[ -z "$VAR" ]] && continue
    if ! echo "$DEFINITIONS" | grep -qxFe "$VAR"; then
      UNDEFINED="${UNDEFINED}${VAR}\n"
    fi
  done <<< "$REFERENCES"
fi

# ── 4. Migration mode: suggest replacements for undefined vars ──
if $MIGRATION_MODE; then
  echo "=== CSS Variable Migration Table ==="
  echo ""
  printf "%-30s → %s\n" "Undefined Variable" "Suggested Replacement"
  printf "%-30s   %s\n" "------------------------------" "---------------------"

  if [[ -z "$UNDEFINED" ]]; then
    echo "(no undefined variables found)"
    exit 0
  fi

  # Build a simple suggestion map from defined vars
  while IFS= read -r VAR; do
    [[ -z "$VAR" ]] && continue
    # Strip leading --
    BARE="${VAR#--}"
    SUGGESTION="(no suggestion)"

    # Try common migration patterns
    # Legacy color aliases → semantic vars
    case "$BARE" in
      white)       SUGGESTION="--text-primary" ;;
      gray)        SUGGESTION="--text-secondary" ;;
      gray2)       SUGGESTION="--text-muted" ;;
      amber)       SUGGESTION="--primary" ;;
      dark)        SUGGESTION="--bg" ;;
      dark2)       SUGGESTION="--surface" ;;
      dark3)       SUGGESTION="--surface-2" ;;
      *)
        # Fuzzy: find a defined var containing the same stem
        STEM=$(echo "$BARE" | sed 's/-light$//; s/-dark$//; s/-bg$//; s/-[0-9]*$//')
        MATCH=$(echo "$DEFINITIONS" | grep -i "$STEM" | head -1 || true)
        if [[ -n "$MATCH" ]]; then
          SUGGESTION="$MATCH (fuzzy match)"
        fi
        ;;
    esac

    printf "%-30s → %s\n" "$VAR" "$SUGGESTION"
  done < <(echo -e "$UNDEFINED")

  echo ""
  exit 0
fi

# ── 5. Normal mode: report undefined variables ──
if [[ -z "$UNDEFINED" ]]; then
  echo "✓ CSS variable check passed — no undefined references."
  exit 0
fi

# Count undefined vars
COUNT=$(echo -e "$UNDEFINED" | grep -c '[^ ]' || true)

echo "=== CSS Variable Drift — $COUNT undefined reference(s) ==="
echo ""

# Show which files reference each undefined var
while IFS= read -r VAR; do
  [[ -z "$VAR" ]] && continue
  echo "  $VAR"
  find "$CLIENT_SRC" -name "*.css" -type f -not -path "$STYLES_DIR/*" 2>/dev/null |
    xargs grep -lne "var(${VAR})" 2>/dev/null |
    sed "s|^$ROOT/||" |
    sed 's/^/    ← /'
done < <(echo -e "$UNDEFINED")

echo ""
echo "Fix: Define missing variables in themes.css or replace with existing ones."
echo "Hint: Run with --migration for a suggested replacement table."
exit 1
