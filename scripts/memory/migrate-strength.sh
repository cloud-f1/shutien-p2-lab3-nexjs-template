#!/bin/bash
# E181 — One-time migration: add strength frontmatter fields to Tier 0 files.
#
# Walks the 8 documented Tier 0 files (per scripts/memory/half-life-defaults.json)
# and ensures each has these E181 keys in its frontmatter:
#
#   strength: 0.5         (default — neutral starting score in [0,1])
#   last_retrieved: <today>
#   retrieval_count: 0
#   created: <git-log first-touch ISO date, or today as fallback>
#
# Idempotent: keys already set are left alone (so reruns don't reset
# accumulated strength). Only missing keys are inserted.
#
# Usage:
#   scripts/memory/migrate-strength.sh                # default Tier 0 dir
#   scripts/memory/migrate-strength.sh --dir <path>   # custom (used by tests)
#   scripts/memory/migrate-strength.sh --dry-run      # report only
#
# Env overrides (test injection):
#   HALF_LIFE_DEFAULTS_JSON  override path to half-life-defaults.json
#   TEMPLATE_MEMORY_DIR      override default Tier 0 dir
#   STRENGTH_NOW             override "today" ISO date (testing)

set -e

DRY_RUN=0
TARGET_DIR=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --dir)     TARGET_DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEFAULTS_JSON="${HALF_LIFE_DEFAULTS_JSON:-$REPO_ROOT/scripts/memory/half-life-defaults.json}"

if [ -z "$TARGET_DIR" ]; then
  TARGET_DIR="${TEMPLATE_MEMORY_DIR:-$HOME/.claude/template-memory}"
fi

[ -d "$TARGET_DIR" ] || { echo "error: target dir not found: $TARGET_DIR" >&2; exit 1; }
[ -f "$DEFAULTS_JSON" ] || { echo "error: defaults JSON missing: $DEFAULTS_JSON" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "error: jq required" >&2; exit 1; }

today_iso() {
  if [ -n "${STRENGTH_NOW:-}" ]; then
    echo "$STRENGTH_NOW"
  else
    date -u +"%Y-%m-%d"
  fi
}

# Read a key from leading frontmatter (returns empty if absent / no FM).
fm_has_key() {
  local file="$1" key="$2"
  awk -v key="$key" '
    BEGIN { in_fm = 0; fm_count = 0; found = 0 }
    /^---[[:space:]]*$/ {
      fm_count++
      if (fm_count == 1) { in_fm = 1; next }
      if (fm_count == 2) { exit }
      next
    }
    in_fm {
      pat = "^" key ":[[:space:]]"
      if ($0 ~ pat) { found = 1; exit }
    }
    END { exit (found ? 0 : 1) }
  ' "$file"
}

# Insert key/value before the closing `---` of leading frontmatter, OR
# create a fresh frontmatter block if none exists.
fm_insert() {
  local file="$1" key="$2" value="$3"
  local first_line
  first_line=$(head -n 1 "$file" 2>/dev/null || echo "")
  local tmp; tmp=$(mktemp)
  if [ "$first_line" = "---" ]; then
    awk -v key="$key" -v value="$value" '
      BEGIN { fm_count = 0; printed = 0 }
      /^---[[:space:]]*$/ {
        fm_count++
        if (fm_count == 2 && !printed) { print key ": " value; printed = 1 }
        print; next
      }
      { print }
    ' "$file" > "$tmp"
  else
    {
      echo "---"
      echo "$key: $value"
      echo "tier: 0"
      echo "---"
      cat "$file"
    } > "$tmp"
  fi
  mv "$tmp" "$file"
}

# Best-effort first-touch ISO date for the file (git log). Falls back to today.
first_touch_iso() {
  local file="$1"
  local d
  d=$(git -C "$REPO_ROOT" log --diff-filter=A --follow --format=%cs -- "$file" 2>/dev/null | tail -1)
  if [ -n "$d" ]; then
    echo "$d"
  else
    today_iso
  fi
}

NOW=$(today_iso)

INSERTED=0
SKIPPED=0
MISSING=0

FILES=$(jq -r '.defaults | keys[]' "$DEFAULTS_JSON")
for name in $FILES; do
  path="$TARGET_DIR/$name"
  if [ ! -f "$path" ]; then
    echo "  [skip] missing on disk: $name"
    MISSING=$((MISSING + 1))
    continue
  fi

  CREATED_DEFAULT=$(first_touch_iso "$path")

  for pair in "strength=0.5" "last_retrieved=$NOW" "retrieval_count=0" "created=$CREATED_DEFAULT"; do
    key="${pair%%=*}"
    val="${pair#*=}"
    if fm_has_key "$path" "$key"; then
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
    if [ "$DRY_RUN" = "1" ]; then
      echo "  [would-insert] $name :: $key = $val"
    else
      fm_insert "$path" "$key" "$val"
      echo "  [insert]       $name :: $key = $val"
    fi
    INSERTED=$((INSERTED + 1))
  done
done

echo ""
echo "Summary:"
echo "  keys inserted:   $INSERTED"
echo "  keys preserved:  $SKIPPED"
echo "  files missing:   $MISSING"
