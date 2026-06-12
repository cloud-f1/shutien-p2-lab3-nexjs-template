#!/bin/bash
# E185 — Backfill half_life_days frontmatter on Tier 0 memory files.
#
# Walks the 8 documented Tier 0 files (per scripts/memory/half-life-defaults.json)
# and ensures each has a YAML frontmatter block with `half_life_days:` set
# to the file's default.
#
# Idempotent: running twice produces the same content.
# Behaviour:
#   - File has no frontmatter        -> prepend `--- ... ---` block with
#                                       half_life_days + tier + source.
#   - File has frontmatter, no key   -> insert `half_life_days:` at the end
#                                       of the frontmatter block.
#   - File has frontmatter + key     -> leave alone (per-file overrides
#                                       are explicitly allowed).
#
# Usage:
#   scripts/memory/backfill-half-life.sh                # default Tier 0 dir
#   scripts/memory/backfill-half-life.sh --dir <path>   # custom (used by tests)
#   scripts/memory/backfill-half-life.sh --dry-run      # report only
#
# Env overrides (test-injection):
#   HALF_LIFE_DEFAULTS_JSON  override path to half-life-defaults.json
#   TEMPLATE_MEMORY_DIR      override default Tier 0 dir (~/.claude/template-memory)

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

if [ ! -d "$TARGET_DIR" ]; then
  echo "error: target dir not found: $TARGET_DIR" >&2
  exit 1
fi

if [ ! -f "$DEFAULTS_JSON" ]; then
  echo "error: defaults JSON missing: $DEFAULTS_JSON" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 1
fi

# Iterate over documented files.
FILES=$(jq -r '.defaults | keys[]' "$DEFAULTS_JSON")

NEW_BLOCK_COUNT=0
INSERTED_KEY_COUNT=0
ALREADY_OK_COUNT=0
MISSING_COUNT=0

for name in $FILES; do
  path="$TARGET_DIR/$name"
  default=$(jq -r --arg name "$name" '.defaults[$name]' "$DEFAULTS_JSON")

  if [ ! -f "$path" ]; then
    echo "  [skip] missing on disk: $name"
    MISSING_COUNT=$((MISSING_COUNT + 1))
    continue
  fi

  # Detect existing frontmatter: file starts with `---` on line 1.
  first_line=$(head -n 1 "$path")
  has_fm=0
  has_key=0
  if [ "$first_line" = "---" ]; then
    has_fm=1
    # Look for the key inside the (first) frontmatter block.
    if awk '
      BEGIN { in_fm = 0; fm_count = 0 }
      /^---[[:space:]]*$/ {
        fm_count++
        if (fm_count == 1) { in_fm = 1; next }
        if (fm_count == 2) { exit }
      }
      in_fm && /^half_life_days:[[:space:]]/ { found = 1; exit }
      END { exit (found ? 0 : 1) }
    ' "$path"; then
      has_key=1
    fi
  fi

  if [ "$has_key" = "1" ]; then
    echo "  [keep] $name — half_life_days already present"
    ALREADY_OK_COUNT=$((ALREADY_OK_COUNT + 1))
    continue
  fi

  if [ "$DRY_RUN" = "1" ]; then
    if [ "$has_fm" = "1" ]; then
      echo "  [would-insert] $name — half_life_days: $default (into existing frontmatter)"
    else
      echo "  [would-prepend] $name — new frontmatter with half_life_days: $default"
    fi
    continue
  fi

  tmp=$(mktemp)
  if [ "$has_fm" = "1" ]; then
    # Insert key before the closing `---` of the first frontmatter block.
    awk -v key="half_life_days: $default" '
      BEGIN { fm_count = 0; printed = 0 }
      /^---[[:space:]]*$/ {
        fm_count++
        if (fm_count == 2 && !printed) { print key; printed = 1 }
        print; next
      }
      { print }
    ' "$path" > "$tmp"
    INSERTED_KEY_COUNT=$((INSERTED_KEY_COUNT + 1))
    echo "  [insert]   $name — half_life_days: $default"
  else
    # Prepend a new frontmatter block.
    {
      echo "---"
      echo "half_life_days: $default"
      echo "tier: 0"
      echo "source: e185-backfill"
      echo "---"
      cat "$path"
    } > "$tmp"
    NEW_BLOCK_COUNT=$((NEW_BLOCK_COUNT + 1))
    echo "  [prepend]  $name — new frontmatter, half_life_days: $default"
  fi
  mv "$tmp" "$path"
done

echo ""
echo "Summary:"
echo "  new frontmatter blocks: $NEW_BLOCK_COUNT"
echo "  inserted-key only:      $INSERTED_KEY_COUNT"
echo "  already had key:        $ALREADY_OK_COUNT"
echo "  missing on disk:        $MISSING_COUNT"
