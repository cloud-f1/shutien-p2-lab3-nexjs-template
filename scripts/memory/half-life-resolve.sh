#!/bin/bash
# E185 — half-life resolver
#
# Resolves the `half_life_days` for a Tier 0 memory file using the
# documented precedence:
#
#   1. YAML frontmatter `half_life_days:` in the file itself
#   2. `scripts/memory/half-life-defaults.json` keyed by basename
#   3. fallback (default 180)
#
# Usage:
#   scripts/memory/half-life-resolve.sh <path-to-md-file>
#
# Prints the resolved integer to stdout. Exits 0 on success, 1 on bad
# input (file missing, jq missing).
#
# This script is the canonical lookup. E181's `score.sh` is expected to
# source it via `$(scripts/memory/half-life-resolve.sh "$file")` rather
# than reimplement the precedence.
#
# Env overrides (test-injection):
#   HALF_LIFE_DEFAULTS_JSON  override path to half-life-defaults.json

set -e

usage() {
  echo "usage: $0 <path-to-md-file>" >&2
  exit 1
}

[ "$#" -eq 1 ] || usage
FILE="$1"

if [ ! -f "$FILE" ]; then
  echo "error: not a file: $FILE" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEFAULTS_JSON="${HALF_LIFE_DEFAULTS_JSON:-$REPO_ROOT/scripts/memory/half-life-defaults.json}"

# 1. Look for `half_life_days:` in YAML frontmatter (between leading
#    `---` fences). Awk extracts the first such block.
FM_VALUE=$(awk '
  BEGIN { in_fm = 0; fm_count = 0 }
  /^---[[:space:]]*$/ {
    fm_count++
    if (fm_count == 1) { in_fm = 1; next }
    if (fm_count == 2) { in_fm = 0; exit }
    next
  }
  in_fm && /^half_life_days:[[:space:]]/ {
    sub(/^half_life_days:[[:space:]]+/, "", $0)
    sub(/[[:space:]]+#.*$/, "", $0)
    sub(/[[:space:]]+$/, "", $0)
    print $0
    exit
  }
' "$FILE")

if [ -n "$FM_VALUE" ] && [ "$FM_VALUE" -eq "$FM_VALUE" ] 2>/dev/null; then
  echo "$FM_VALUE"
  exit 0
fi

# 2. Look up in defaults JSON by basename.
BASENAME=$(basename "$FILE")
FALLBACK=180

if [ -f "$DEFAULTS_JSON" ] && command -v jq >/dev/null 2>&1; then
  JSON_VALUE=$(jq -r --arg name "$BASENAME" '.defaults[$name] // empty' "$DEFAULTS_JSON" 2>/dev/null || true)
  if [ -n "$JSON_VALUE" ] && [ "$JSON_VALUE" != "null" ]; then
    echo "$JSON_VALUE"
    exit 0
  fi

  # Pull the documented fallback from the JSON if present.
  JSON_FALLBACK=$(jq -r '.fallback_days // empty' "$DEFAULTS_JSON" 2>/dev/null || true)
  if [ -n "$JSON_FALLBACK" ] && [ "$JSON_FALLBACK" != "null" ]; then
    FALLBACK="$JSON_FALLBACK"
  fi
fi

# 3. Hardcoded fallback.
echo "$FALLBACK"
