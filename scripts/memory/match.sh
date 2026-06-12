#!/bin/bash
# E182 — Lesson cue-match scorer.
#
# Computes the relevance score for a single Tier 0 lesson against the active
# SessionStart cue (changed-file path prefixes + inferred tags). The cue is
# passed as two flat newline-separated streams via `--paths` and `--tags`
# (or via env vars E182_PATHS / E182_TAGS for callers that prefer to keep
# the args minimal).
#
# Score formula (from docs/epics/e182-selective-sessionstart-injection.md):
#
#     score = 3 * |lesson.domains ∩ cue.path_prefixes|
#           + 2 * |lesson.tags    ∩ cue.tags|
#           + 1 * lesson.strength    (tie-break by usefulness)
#
# `lesson.strength` is sourced from E181's `score.sh get` — DO NOT
# reimplement frontmatter parsing.
#
# Lessons tagged `evergreen` always score >= EVERGREEN_FLOOR (default 100)
# so they bypass the budget cap. The floor is added on top of the formula
# so an evergreen lesson with strong cue match still ranks above a
# evergreen lesson with no match.
#
# Usage:
#   match.sh <lesson-file>                  # cue read from env vars
#   match.sh <lesson-file> --paths <stream> --tags <stream>
#
# `<stream>` is a newline-separated string. Pass `-` to read from stdin
# (NOT YET — reserved). Empty values are tolerated (zero-score path).
#
# Output:  one floating-point score on stdout, e.g. "5.6500".
# Exit 0 always (a missing lesson scores 0).
#
# Env overrides:
#   LESSON_TAGS_JSON       override default sidecar map
#   E182_PATHS             cue path-prefix stream (newline-sep)
#   E182_TAGS              cue tag stream (newline-sep)
#   E182_EVERGREEN_FLOOR   numeric floor for evergreen lessons (default 100)
#   TEMPLATE_MEMORY_DIR    override Tier 0 dir (used to resolve frontmatter)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SIDECAR_DEFAULT="$REPO_ROOT/scripts/memory/lesson-tags.json"
SIDECAR_JSON="${LESSON_TAGS_JSON:-$SIDECAR_DEFAULT}"
SCORE_SH="$REPO_ROOT/scripts/memory/score.sh"
EVERGREEN_FLOOR="${E182_EVERGREEN_FLOOR:-100}"

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

# Read a YAML list value (`key: [a, b, c]` flow style or `key:\n  - a` block)
# from the leading frontmatter block. Echoes one item per line. Empty if
# missing. Frontmatter override takes precedence over the sidecar.
fm_list() {
  local file="$1" key="$2"
  awk -v key="$key" '
    BEGIN { in_fm = 0; fm_count = 0; capturing = 0 }
    /^---[[:space:]]*$/ {
      fm_count++
      if (fm_count == 1) { in_fm = 1; next }
      if (fm_count == 2) { exit }
      next
    }
    !in_fm { next }
    {
      pat_flow = "^" key ":[[:space:]]*\\["
      pat_block = "^" key ":[[:space:]]*$"
      pat_inline = "^" key ":[[:space:]]+"
      if (capturing) {
        if ($0 ~ /^[[:space:]]+-[[:space:]]+/) {
          v = $0
          sub(/^[[:space:]]+-[[:space:]]+/, "", v)
          gsub(/^["'"'"']|["'"'"']$/, "", v)
          gsub(/[[:space:]]+#.*$/, "", v)
          gsub(/[[:space:]]+$/, "", v)
          if (v != "") print v
          next
        } else {
          capturing = 0
        }
      }
      if ($0 ~ pat_flow) {
        v = $0
        sub(/^[^\[]*\[/, "", v)
        sub(/\].*$/, "", v)
        n = split(v, a, ",")
        for (i = 1; i <= n; i++) {
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", a[i])
          gsub(/^["'"'"']|["'"'"']$/, "", a[i])
          if (a[i] != "") print a[i]
        }
        next
      }
      if ($0 ~ pat_block) {
        capturing = 1
        next
      }
      if ($0 ~ pat_inline) {
        # Single string inline — treat as one item.
        v = $0
        sub(pat_inline, "", v)
        gsub(/^["'"'"']|["'"'"']$/, "", v)
        gsub(/[[:space:]]+#.*$/, "", v)
        gsub(/[[:space:]]+$/, "", v)
        if (v != "") print v
        next
      }
    }
  ' "$file" 2>/dev/null
}

# Returns 0 if `key:` appears in the leading frontmatter block, 1 otherwise.
# Used by resolve_* to distinguish "key present but empty" (override wins,
# even if list is []) from "key absent" (fall back to sidecar).
fm_has_key() {
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
      pat = "^" key ":([[:space:]]|$)"
      if ($0 ~ pat) { print "1"; exit }
    }
  ' "$file" 2>/dev/null
}

# Read a scalar bool/string from frontmatter. Echo "" if missing.
fm_scalar() {
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
        v = $0
        sub(pat, "", v)
        sub(/[[:space:]]+#.*$/, "", v)
        sub(/[[:space:]]+$/, "", v)
        gsub(/^["'"'"']|["'"'"']$/, "", v)
        print v
        exit
      }
    }
  ' "$file" 2>/dev/null
}

# Resolve a lesson's tags: file frontmatter (even if empty list) wins over
# the sidecar default. Only fall back to sidecar when the key is absent.
resolve_tags() {
  local file="$1"
  if [ "$(fm_has_key "$file" tags)" = "1" ]; then
    fm_list "$file" tags
    return
  fi
  if command -v jq >/dev/null 2>&1 && [ -f "$SIDECAR_JSON" ]; then
    local base
    base=$(basename "$file")
    jq -r --arg n "$base" '.defaults[$n].tags // [] | .[]' "$SIDECAR_JSON" 2>/dev/null
  fi
}

# Resolve a lesson's domains: same precedence as resolve_tags.
resolve_domains() {
  local file="$1"
  if [ "$(fm_has_key "$file" domains)" = "1" ]; then
    fm_list "$file" domains
    return
  fi
  if command -v jq >/dev/null 2>&1 && [ -f "$SIDECAR_JSON" ]; then
    local base
    base=$(basename "$file")
    jq -r --arg n "$base" '.defaults[$n].domains // [] | .[]' "$SIDECAR_JSON" 2>/dev/null
  fi
}

# Resolve evergreen flag: file frontmatter > sidecar > false. The flag
# bypasses scoring and pins the lesson to always-load (with EVERGREEN_FLOOR
# added so cue match still ranks within the evergreen tier).
resolve_evergreen() {
  local file="$1"
  local fm_ev
  fm_ev=$(fm_scalar "$file" evergreen)
  if [ -n "$fm_ev" ]; then
    case "$fm_ev" in true|yes|1) echo "1"; return ;; *) echo "0"; return ;; esac
  fi
  if command -v jq >/dev/null 2>&1 && [ -f "$SIDECAR_JSON" ]; then
    local base
    base=$(basename "$file")
    local sv
    sv=$(jq -r --arg n "$base" '.defaults[$n].evergreen // false' "$SIDECAR_JSON" 2>/dev/null)
    case "$sv" in true) echo "1"; return ;; esac
  fi
  echo "0"
}

# Count overlap between two newline-separated streams. Empty streams -> 0.
# Uses two temp files + awk's `NR == FNR` idiom for portable set membership
# (works on both BSD and GNU awk; passing newlines via `-v` does not).
count_overlap() {
  local a="$1" b="$2"
  [ -z "$a" ] || [ -z "$b" ] && { echo "0"; return; }
  local fa fb
  fa=$(mktemp); fb=$(mktemp)
  printf '%s\n' "$a" > "$fa"
  printf '%s\n' "$b" > "$fb"
  awk '
    NR == FNR { if ($0 != "") set[$0] = 1; next }
    {
      if ($0 == "") next
      if (($0 in set) && !($0 in already)) { hits++; already[$0] = 1 }
    }
    END { print hits + 0 }
  ' "$fb" "$fa"
  rm -f "$fa" "$fb"
}

# Path-prefix overlap: a domain matches a changed file if the file path
# STARTS WITH the domain string. Counts unique domain matches.
count_path_overlap() {
  local domains="$1" paths="$2"
  [ -z "$domains" ] || [ -z "$paths" ] && { echo "0"; return; }
  local hits=0
  local d
  while IFS= read -r d; do
    [ -z "$d" ] && continue
    # awk -v d to find any path that starts with d (escape any awk regex chars).
    if printf '%s\n' "$paths" | awk -v d="$d" 'BEGIN { ok = 0 } {
      if (index($0, d) == 1 && $0 != "") ok = 1
    } END { exit (ok ? 0 : 1) }'; then
      hits=$((hits + 1))
    fi
  done <<< "$domains"
  echo "$hits"
}

# Source the lesson strength from E181's score.sh. Default 0.5 if unavailable.
get_strength() {
  local file="$1"
  if [ -x "$SCORE_SH" ]; then
    "$SCORE_SH" get "$file" 2>/dev/null || echo "0.5"
  else
    echo "0.5"
  fi
}

# ---- main ------------------------------------------------------------------

[ "$#" -ge 1 ] || usage
LESSON="$1"; shift || true
[ -f "$LESSON" ] || { echo "0.0000"; exit 0; }

PATHS_CUE="${E182_PATHS:-}"
TAGS_CUE="${E182_TAGS:-}"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --paths) shift; PATHS_CUE="${1:-}"; shift || true ;;
    --tags)  shift; TAGS_CUE="${1:-}";  shift || true ;;
    -h|--help) usage ;;
    *) shift ;;
  esac
done

LESSON_TAGS=$(resolve_tags "$LESSON")
LESSON_DOMS=$(resolve_domains "$LESSON")
EVERGREEN=$(resolve_evergreen "$LESSON")

DOM_HITS=$(count_path_overlap "$LESSON_DOMS" "$PATHS_CUE")
TAG_HITS=$(count_overlap "$LESSON_TAGS" "$TAGS_CUE")
STRENGTH=$(get_strength "$LESSON")

awk -v dh="$DOM_HITS" -v th="$TAG_HITS" -v s="$STRENGTH" -v ev="$EVERGREEN" -v floor="$EVERGREEN_FLOOR" '
  BEGIN {
    score = (3 * dh) + (2 * th) + s
    if (ev == "1") score = score + floor
    printf "%.4f\n", score
  }
'
