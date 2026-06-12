#!/bin/bash
# E184 — `/athena:forget` archive engine.
#
# Archives weak Tier 0 lessons (strength below threshold) to a `_archive/`
# subfolder. Reversible by design via `--revive`.
#
# Closes the Ebbinghaus loop:
#   E180 retrieval signal -> E181 strength score -> E183 detects stale promotions
#   -> E184 (this script) archives them; revival is one command away.
#
# Subcommands:
#   forget.sh list                       -- print archive candidates (no writes)
#   forget.sh dry-run                    -- alias for list (no writes)
#   forget.sh apply [--threshold X]      -- atomically archive weak lessons
#                                           (default threshold: 0.10)
#   forget.sh revive <basename>          -- move a lesson back from _archive/
#   forget.sh list-archived              -- print currently archived lessons
#
# Source of candidates:
#   - PRIMARY: `score.sh flag-weak` (E181) — lessons with S < threshold
#   - SECONDARY (advisory only, surfaced in dry-run output if available):
#     `promotion-follow-through.sh --json` (E183) stale promotions
#
# Write surface:
#   - Move file: `<dir>/<lesson>.md` -> `<dir>/_archive/<lesson>.md`
#   - Append YAML key `archived_at: <ISO date>` into frontmatter (idempotent;
#     enables round-trip via revive)
#   - Append a row to `<dir>/_archive/forgotten.md` (rolling log)
#   - Delete the lesson's entry from `lesson-tags.json` sidecar (if present);
#     `revive` re-creates it from the archived frontmatter.
#
# Read-only Tier 0 invariant EXCEPT for archive operations:
#   This script may move files INTO/OUT of `_archive/` and may rewrite
#   `lesson-tags.json`. It MAY NOT mutate any other Tier 0 file's content.
#
# Audit events:
#   `lesson_archived`  ts, lesson, strength, threshold, epic
#   `lesson_revived`   ts, lesson, epic
#
# Env overrides (test injection):
#   TEMPLATE_MEMORY_DIR     override default ~/.claude/template-memory
#   AUDIT_LOG_PATH          override .claude/audit.jsonl
#   LESSON_TAGS_JSON        override sidecar map path
#   STRENGTH_NOW            override "today" ISO date (testing)
#   FORGET_THRESHOLD        override default 0.10 strength threshold
#   PROMOTION_FOLLOW_THROUGH override path to promotion-follow-through.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCORE_SH="$REPO_ROOT/scripts/memory/score.sh"
PFT_SH="${PROMOTION_FOLLOW_THROUGH:-$REPO_ROOT/scripts/memory/promotion-follow-through.sh}"
DEFAULTS_JSON="${HALF_LIFE_DEFAULTS_JSON:-$REPO_ROOT/scripts/memory/half-life-defaults.json}"
AUDIT_LOG="${AUDIT_LOG_PATH:-$REPO_ROOT/.claude/audit.jsonl}"
TIER0_DIR_DEFAULT="${TEMPLATE_MEMORY_DIR:-$HOME/.claude/template-memory}"
# NOTE: use `:-` carefully — an unset OR empty `LESSON_TAGS_JSON` would
# silently fall back to the real repo path. We want unset -> default, but
# empty -> respect explicit empty (treated as "no sidecar"). Test fixtures
# may otherwise clobber the real file.
if [ -z "${LESSON_TAGS_JSON+set}" ]; then
  TAGS_JSON_DEFAULT="$REPO_ROOT/scripts/memory/lesson-tags.json"
else
  TAGS_JSON_DEFAULT="$LESSON_TAGS_JSON"
fi
DEFAULT_THRESHOLD="${FORGET_THRESHOLD:-0.10}"

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

today_iso() {
  if [ -n "${STRENGTH_NOW:-}" ]; then
    echo "$STRENGTH_NOW"
  else
    date -u +"%Y-%m-%d"
  fi
}

today_ts_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# ---- frontmatter helpers (mirror score.sh's parser exactly) ---------------

fm_get() {
  local file="$1" key="$2"
  awk -v key="$key" '
    BEGIN { in_fm = 0; fm_count = 0 }
    /^---[[:space:]]*$/ {
      fm_count++
      if (fm_count == 1) { in_fm = 1; next }
      if (fm_count == 2) { exit }
      next
    }
    in_fm {
      pat = "^" key ":[[:space:]]+"
      if ($0 ~ pat) {
        sub(pat, "", $0)
        sub(/[[:space:]]+#.*$/, "", $0)
        sub(/[[:space:]]+$/, "", $0)
        print $0
        exit
      }
    }
  ' "$file"
}

fm_set() {
  local file="$1" key="$2" value="$3"
  local first_line
  first_line=$(head -n 1 "$file" 2>/dev/null || echo "")
  local tmp; tmp=$(mktemp)
  if [ "$first_line" = "---" ]; then
    awk -v key="$key" -v value="$value" '
      BEGIN { in_fm = 0; fm_count = 0; replaced = 0 }
      /^---[[:space:]]*$/ {
        fm_count++
        if (fm_count == 1) { in_fm = 1; print; next }
        if (fm_count == 2) {
          if (!replaced) { print key ": " value; replaced = 1 }
          in_fm = 0
          print
          next
        }
        print
        next
      }
      in_fm {
        pat = "^" key ":[[:space:]]"
        if ($0 ~ pat) {
          if (!replaced) { print key ": " value; replaced = 1 }
          next
        }
        print
        next
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

# Remove a key from frontmatter. No-op if absent.
fm_unset() {
  local file="$1" key="$2"
  local first_line
  first_line=$(head -n 1 "$file" 2>/dev/null || echo "")
  [ "$first_line" = "---" ] || return 0
  local tmp; tmp=$(mktemp)
  awk -v key="$key" '
    BEGIN { in_fm = 0; fm_count = 0 }
    /^---[[:space:]]*$/ {
      fm_count++
      if (fm_count == 1) { in_fm = 1; print; next }
      if (fm_count == 2) { in_fm = 0; print; next }
      print; next
    }
    in_fm {
      pat = "^" key ":[[:space:]]"
      if ($0 ~ pat) next
      print; next
    }
    { print }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

# ---- audit emit ------------------------------------------------------------

emit_event() {
  # Args: <event> <lesson> [strength] [threshold]
  local event="$1" lesson="$2" strength="${3:-}" threshold="${4:-}"
  command -v jq >/dev/null 2>&1 || return 0
  mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null
  local ts; ts=$(today_ts_iso)
  local epic
  epic=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null \
    | sed -n 's/.*\(E[0-9]\{1,\}\).*/\1/Ip' \
    | tr '[:lower:]' '[:upper:]')
  [ -z "$epic" ] && epic="none"

  if [ -n "$strength" ] && [ -n "$threshold" ]; then
    jq -n -c \
      --arg ts "$ts" \
      --arg event "$event" \
      --arg lesson "$lesson" \
      --arg epic "$epic" \
      --argjson strength "$strength" \
      --argjson threshold "$threshold" \
      '{ts:$ts,event:$event,lesson:$lesson,strength:$strength,threshold:$threshold,epic:$epic}' \
      >> "$AUDIT_LOG" 2>/dev/null || true
  else
    jq -n -c \
      --arg ts "$ts" \
      --arg event "$event" \
      --arg lesson "$lesson" \
      --arg epic "$epic" \
      '{ts:$ts,event:$event,lesson:$lesson,epic:$epic}' \
      >> "$AUDIT_LOG" 2>/dev/null || true
  fi
}

# ---- candidates (delegates to E181 score.sh flag-weak) --------------------

# Print "<basename>\t<strength>" lines for every lesson with S < threshold.
# Uses score.sh flag-weak (which uses the 0.10 baseline) plus a manual sweep
# when the caller supplies a custom threshold above 0.10.
collect_candidates() {
  local dir="$1" threshold="$2"
  [ -d "$dir" ] || return 0
  command -v jq >/dev/null 2>&1 || return 0
  [ -f "$DEFAULTS_JSON" ] || return 0

  for name in $(jq -r '.defaults | keys[]' "$DEFAULTS_JSON"); do
    local path="$dir/$name"
    [ -f "$path" ] || continue
    local s
    s=$("$SCORE_SH" get "$path" 2>/dev/null || echo "0.5000")
    awk -v n="$name" -v s="$s" -v t="$threshold" \
      'BEGIN { if (s + 0 < t + 0) printf "%s\t%.4f\n", n, s }'
  done

  # Also walk any non-defaults .md files in the dir (user-promoted lessons
  # not in half-life-defaults.json). Skip README/CLAUDE/_archive entries.
  for path in "$dir"/*.md; do
    [ -f "$path" ] || continue
    local base; base=$(basename "$path")
    case "$base" in
      README.md|CLAUDE.md) continue ;;
    esac
    # Skip if already covered by the defaults sweep above.
    if jq -e --arg n "$base" '.defaults[$n]' "$DEFAULTS_JSON" >/dev/null 2>&1; then
      continue
    fi
    local s
    s=$("$SCORE_SH" get "$path" 2>/dev/null || echo "0.5000")
    awk -v n="$base" -v s="$s" -v t="$threshold" \
      'BEGIN { if (s + 0 < t + 0) printf "%s\t%.4f\n", n, s }'
  done
}

# ---- lesson-tags.json sidecar maintenance ---------------------------------

# Capture a lesson's sidecar entry as a JSON object, or empty string.
tags_get_entry() {
  local basename="$1"
  [ -f "$TAGS_JSON_DEFAULT" ] || { echo ""; return; }
  command -v jq >/dev/null 2>&1 || { echo ""; return; }
  jq -c --arg n "$basename" '.defaults[$n] // empty' "$TAGS_JSON_DEFAULT" 2>/dev/null
}

# Delete a lesson's sidecar entry (in-place rewrite). No-op if absent.
tags_delete_entry() {
  local basename="$1"
  [ -f "$TAGS_JSON_DEFAULT" ] || return 0
  command -v jq >/dev/null 2>&1 || return 0
  local tmp; tmp=$(mktemp)
  jq --arg n "$basename" 'del(.defaults[$n])' "$TAGS_JSON_DEFAULT" > "$tmp" 2>/dev/null \
    && mv "$tmp" "$TAGS_JSON_DEFAULT" \
    || rm -f "$tmp"
}

# Restore a lesson's sidecar entry from a JSON object string. No-op on empty.
tags_restore_entry() {
  local basename="$1" entry="$2"
  [ -z "$entry" ] && return 0
  [ -f "$TAGS_JSON_DEFAULT" ] || return 0
  command -v jq >/dev/null 2>&1 || return 0
  local tmp; tmp=$(mktemp)
  jq --arg n "$basename" --argjson e "$entry" \
    '.defaults[$n] = $e' "$TAGS_JSON_DEFAULT" > "$tmp" 2>/dev/null \
    && mv "$tmp" "$TAGS_JSON_DEFAULT" \
    || rm -f "$tmp"
}

# ---- forgotten.md rolling log ---------------------------------------------

ensure_forgotten_log() {
  local archive_dir="$1"
  local log="$archive_dir/forgotten.md"
  if [ ! -f "$log" ]; then
    {
      echo "# Forgotten Lessons — Tier 0 Archive Log"
      echo ""
      echo "_Append-only. Each archive operation lands a row here. Revive removes it._"
      echo ""
      echo "| Date | Lesson | Last strength | Threshold | Action | Reason |"
      echo "|------|--------|---------------|-----------|--------|--------|"
    } > "$log"
  fi
}

append_forgotten_row() {
  local log="$1" lesson="$2" strength="$3" threshold="$4" reason="$5"
  local d; d=$(today_iso)
  printf "| %s | %s | %s | %s | archived | %s |\n" \
    "$d" "$lesson" "$strength" "$threshold" "$reason" >> "$log"
}

# Remove the most-recent matching `archived` row for a lesson. Idempotent —
# if no row matches, the file is left as-is.
remove_forgotten_row() {
  local log="$1" lesson="$2"
  [ -f "$log" ] || return 0
  local tmp; tmp=$(mktemp)
  awk -v lesson="$lesson" '
    BEGIN { removed = 0 }
    {
      if (!removed && $0 ~ "\\| " lesson " \\|" && $0 ~ /\| archived \|/) {
        removed = 1
        next
      }
      print
    }
  ' "$log" > "$tmp"
  mv "$tmp" "$log"
}

# ---- subcommands -----------------------------------------------------------

cmd_list() {
  local dir="${TEMPLATE_MEMORY_DIR:-$TIER0_DIR_DEFAULT}"
  local threshold="$DEFAULT_THRESHOLD"

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --threshold) threshold="$2"; shift 2 ;;
      --dir)       dir="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [ ! -d "$dir" ]; then
    echo "# /athena:forget — candidates"
    echo ""
    echo "_Tier 0 directory not found: $dir — nothing to do._"
    return 0
  fi

  echo "# /athena:forget — candidates (threshold S < ${threshold})"
  echo ""
  local candidates
  candidates=$(collect_candidates "$dir" "$threshold")
  if [ -z "$candidates" ]; then
    echo "_No weak lessons found. Tier 0 is healthy._"
  else
    echo "| Lesson | Strength |"
    echo "|--------|----------|"
    echo "$candidates" | awk -F'\t' '{ printf "| %s | %s |\n", $1, $2 }'
  fi

  # Secondary input: stale-promotion advisory from E183 (read-only). Best
  # effort — surface as a separate section so callers see both signals.
  if [ -x "$PFT_SH" ]; then
    local stale
    stale=$(TEMPLATE_MEMORY_DIR="$dir" "$PFT_SH" --json 2>/dev/null || echo "[]")
    if command -v jq >/dev/null 2>&1; then
      local stale_count
      stale_count=$(echo "$stale" | jq 'length' 2>/dev/null || echo "0")
      if [ "$stale_count" != "0" ] && [ "$stale_count" != "null" ] && [ -n "$stale_count" ]; then
        echo ""
        echo "## Also stale (E183 advisory — promotion never fired)"
        echo ""
        echo "$stale" | jq -r '.[] | "- \(.basename) (age \(.age_days)d, strength \(.strength))"' 2>/dev/null
      fi
    fi
  fi

  echo ""
  echo "_Run \`forget.sh apply\` to archive these. Run \`forget.sh apply --threshold X\` to override._"
}

cmd_apply() {
  local dir="${TEMPLATE_MEMORY_DIR:-$TIER0_DIR_DEFAULT}"
  local threshold="$DEFAULT_THRESHOLD"

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --threshold) threshold="$2"; shift 2 ;;
      --dir)       dir="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  [ -d "$dir" ] || { echo "error: not a directory: $dir" >&2; exit 1; }

  local archive_dir="$dir/_archive"
  mkdir -p "$archive_dir"
  ensure_forgotten_log "$archive_dir"
  local log="$archive_dir/forgotten.md"

  local candidates
  candidates=$(collect_candidates "$dir" "$threshold")

  if [ -z "$candidates" ]; then
    echo "no candidates — nothing archived"
    return 0
  fi

  local archived=0
  local today; today=$(today_iso)

  while IFS=$'\t' read -r name strength; do
    [ -z "$name" ] && continue
    local src="$dir/$name"
    local dst="$archive_dir/$name"
    [ -f "$src" ] || continue

    # 1) Stamp `archived_at` BEFORE the move so the file always has the marker
    #    if the move succeeds. If we move first and then stamp, a partial
    #    failure leaves the archive with an unstamped file.
    fm_set "$src" archived_at "$today"

    # 2) Atomic move (mv on same filesystem).
    if ! mv "$src" "$dst"; then
      echo "error: failed to archive $name" >&2
      # Roll back the frontmatter stamp on failure.
      fm_unset "$src" archived_at 2>/dev/null || true
      continue
    fi

    # 3) Drop sidecar tag entry (idempotent — no-op if absent).
    tags_delete_entry "$name"

    # 4) Append to the rolling log.
    local reason="strength ${strength} below threshold ${threshold}"
    append_forgotten_row "$log" "$name" "$strength" "$threshold" "$reason"

    # 5) Audit event.
    emit_event "lesson_archived" "$name" "$strength" "$threshold"

    archived=$((archived + 1))
    echo "archived: $name (S=$strength)"
  done <<< "$candidates"

  echo "archived $archived lesson(s) to $archive_dir"
}

cmd_revive() {
  local dir="${TEMPLATE_MEMORY_DIR:-$TIER0_DIR_DEFAULT}"
  local basename=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --dir) dir="$2"; shift 2 ;;
      *)
        if [ -z "$basename" ]; then
          basename="$1"
        fi
        shift
        ;;
    esac
  done

  [ -z "$basename" ] && { echo "error: revive needs a lesson basename" >&2; exit 2; }
  [ -d "$dir" ] || { echo "error: not a directory: $dir" >&2; exit 1; }

  local archive_dir="$dir/_archive"
  local src="$archive_dir/$basename"
  local dst="$dir/$basename"
  local log="$archive_dir/forgotten.md"

  if [ ! -f "$src" ]; then
    echo "error: not in archive: $basename" >&2
    exit 1
  fi
  if [ -f "$dst" ]; then
    echo "error: $basename already exists in $dir — refusing to overwrite" >&2
    exit 1
  fi

  # 1) Capture archived_at value so we can preserve revival history if needed.
  local archived_at; archived_at=$(fm_get "$src" archived_at)

  # 2) Atomic move back.
  if ! mv "$src" "$dst"; then
    echo "error: failed to move $basename out of archive" >&2
    exit 1
  fi

  # 3) Strip the archived_at marker from the revived file (frontmatter stays
  #    otherwise intact — strength, last_retrieved, retrieval_count, half_life
  #    all preserved).
  fm_unset "$dst" archived_at

  # 4) Remove the most-recent matching row from forgotten.md.
  remove_forgotten_row "$log" "$basename"

  # 5) Audit event.
  emit_event "lesson_revived" "$basename"

  echo "revived: $basename (was archived $archived_at)"
}

cmd_list_archived() {
  local dir="${TEMPLATE_MEMORY_DIR:-$TIER0_DIR_DEFAULT}"

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --dir) dir="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  local archive_dir="$dir/_archive"
  if [ ! -d "$archive_dir" ]; then
    echo "_No archive directory yet at $archive_dir._"
    return 0
  fi

  local found=0
  echo "# Archived lessons in $archive_dir"
  echo ""
  for path in "$archive_dir"/*.md; do
    [ -f "$path" ] || continue
    local base; base=$(basename "$path")
    [ "$base" = "forgotten.md" ] && continue
    local archived_at; archived_at=$(fm_get "$path" archived_at)
    [ -z "$archived_at" ] && archived_at="(unknown)"
    echo "- $base (archived $archived_at)"
    found=$((found + 1))
  done
  if [ "$found" = "0" ]; then
    echo "_None._"
  fi
}

# ---- dispatch --------------------------------------------------------------

CMD="${1:-}"
shift || true
case "$CMD" in
  list|dry-run)   cmd_list "$@" ;;
  apply)          cmd_apply "$@" ;;
  revive)         cmd_revive "$@" ;;
  list-archived)  cmd_list_archived "$@" ;;
  -h|--help)      usage ;;
  *)              usage ;;
esac
