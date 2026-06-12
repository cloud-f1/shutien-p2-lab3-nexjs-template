#!/bin/bash
# E189 — Memory-Aware Planning: brainstorm retrieval orchestrator.
#
# Loops over Tier 0 lessons, scores each against brainstorm keywords via
# scripts/memory/match.sh, filters by score + strength (with evergreen bypass),
# returns top-N as JSON. Side-effects: emits tier0_loaded audit events and
# calls score.sh reinforce per matched lesson (per-session deduped).
#
# Usage:
#   brainstorm-retrieve.sh "<keywords-csv>"
#   e.g. brainstorm-retrieve.sh "digest,emails,owners,weekly"
#
# Output (stdout):
#   JSON array: [{"name":"anti-patterns.md","score":2.5,"strength":0.7}, ...]
#   Empty → []
#
# Env overrides (test injection):
#   TEMPLATE_MEMORY_DIR     override ~/.claude/template-memory
#   AUDIT_LOG_PATH          override .claude/audit.jsonl
#   BRAINSTORM_TOP_N        max lessons returned (default 5)
#   BRAINSTORM_MIN_SCORE    min match.sh score to include (default 1.0)
#   BRAINSTORM_MIN_STRENGTH min strength to include (default 0.4; skipped if evergreen)
#   CLOCK_TS                override ISO 8601 timestamp for audit events
#   EPIC                    override epic ID for audit events

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MATCH_SH="$REPO_ROOT/scripts/memory/match.sh"
SCORE_SH="$REPO_ROOT/scripts/memory/score.sh"

TIER0_DIR="${TEMPLATE_MEMORY_DIR:-$HOME/.claude/template-memory}"
AUDIT_LOG="${AUDIT_LOG_PATH:-$REPO_ROOT/.claude/audit.jsonl}"
TOP_N="${BRAINSTORM_TOP_N:-5}"
MIN_SCORE="${BRAINSTORM_MIN_SCORE:-1.0}"
MIN_STRENGTH="${BRAINSTORM_MIN_STRENGTH:-0.4}"

# ---- argument parsing -------------------------------------------------------

usage() {
  echo "Usage: brainstorm-retrieve.sh <keywords-csv>" >&2
  echo "  e.g. brainstorm-retrieve.sh \"digest,emails,owners,weekly\"" >&2
  exit 2
}

[ "$#" -ge 1 ] || usage
KEYWORDS_CSV="$1"

# Build newline-separated tag stream from the CSV
TAG_STREAM=$(printf '%s' "$KEYWORDS_CSV" | tr ',' '\n' | awk 'NF' )

# ---- epic detection ---------------------------------------------------------

detect_epic() {
  if [ -n "${EPIC:-}" ]; then
    echo "$EPIC"
    return
  fi
  git -C "$REPO_ROOT" branch --show-current 2>/dev/null \
    | sed -n 's/.*\(E[0-9]\{1,\}\).*/\1/Ip' \
    | tr '[:lower:]' '[:upper:]' \
    || echo "none"
}

EPIC_ID=$(detect_epic)
[ -z "$EPIC_ID" ] && EPIC_ID="none"

# ---- evergreen check --------------------------------------------------------
# Returns 1 if the lesson file has `evergreen: true` in its YAML frontmatter.

is_evergreen() {
  local file="$1"
  awk '
    BEGIN { in_fm = 0; fm_count = 0 }
    /^---[[:space:]]*$/ {
      fm_count++
      if (fm_count == 1) { in_fm = 1; next }
      if (fm_count == 2) { exit }
      next
    }
    in_fm {
      if ($0 ~ /^evergreen:[[:space:]]*(true|yes|1)[[:space:]]*$/) { print "1"; exit }
    }
  ' "$file" 2>/dev/null | grep -q "1"
}

# ---- strength read ----------------------------------------------------------

get_strength() {
  local file="$1"
  if [ -x "$SCORE_SH" ]; then
    "$SCORE_SH" get "$file" 2>/dev/null || echo "0.5"
  else
    # Fallback: read from frontmatter directly
    awk '
      BEGIN { in_fm = 0; fm_count = 0 }
      /^---[[:space:]]*$/ {
        fm_count++
        if (fm_count == 1) { in_fm = 1; next }
        if (fm_count == 2) { exit }
        next
      }
      in_fm {
        if ($0 ~ /^strength:[[:space:]]+/) {
          v = $0
          sub(/^strength:[[:space:]]+/, "", v)
          sub(/[[:space:]]+#.*$/, "", v)
          sub(/[[:space:]]+$/, "", v)
          print v
          exit
        }
      }
    ' "$file" 2>/dev/null || echo "0.5"
  fi
}

# ---- float comparison helpers -----------------------------------------------

# Returns 0 (true) if $1 >= $2 (float comparison via awk)
float_gte() {
  awk -v a="$1" -v b="$2" 'BEGIN { exit (a >= b) ? 0 : 1 }'
}

# ---- emit audit event -------------------------------------------------------

emit_audit() {
  local lesson_basename="$1"
  command -v jq >/dev/null 2>&1 || return 0
  mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true
  local ts
  ts="${CLOCK_TS:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
  jq -n -c \
    --arg ts    "$ts" \
    --arg event "tier0_loaded" \
    --arg lesson "$lesson_basename" \
    --arg agent "strategist" \
    --arg epic  "$EPIC_ID" \
    --arg ctx   "brainstorm" \
    '{ts:$ts,event:$event,lesson:$lesson,agent:$agent,epic:$epic,context:$ctx}' \
    >> "$AUDIT_LOG" 2>/dev/null || true
}

# ---- reinforce (per-session dedup) -----------------------------------------

reinforce_lesson() {
  local lesson_path="$1"
  local lesson_base
  lesson_base=$(basename "$lesson_path")
  # Use a sentinel file in /tmp scoped to this process group + lesson name
  local sentinel="/tmp/brainstorm-session-$$-${lesson_base}"
  if [ -f "$sentinel" ]; then
    return 0  # already reinforced this session
  fi
  touch "$sentinel" 2>/dev/null || true
  if [ -x "$SCORE_SH" ]; then
    AUDIT_LOG_PATH="$AUDIT_LOG" \
      "$SCORE_SH" reinforce "$lesson_path" agent_cited >/dev/null 2>&1 || true
  fi
}

# ---- main loop --------------------------------------------------------------

# Check Tier 0 dir exists
if [ ! -d "$TIER0_DIR" ]; then
  echo "[]"
  exit 0
fi

# Collect scored candidates into a temp file (score TAB name TAB strength)
CANDIDATES=$(mktemp)
trap 'rm -f "$CANDIDATES"' EXIT

for f in "$TIER0_DIR"/*.md; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  # Skip excluded files
  case "$base" in
    README.md|CLAUDE.md|NEW_PROJECT_PRIMER.md) continue ;;
    *archive*) continue ;;
  esac
  # Skip _archive subdirectory entries (shouldn't match /*.md but guard anyway)
  case "$f" in
    */_archive/*) continue ;;
  esac

  # Compute match score via match.sh (tags only — brainstorm has no path cues)
  score=$("$MATCH_SH" "$f" --tags "$TAG_STREAM" 2>/dev/null || echo "0")

  # Score filter: skip if below minimum
  if ! float_gte "$score" "$MIN_SCORE"; then
    continue
  fi

  # Strength filter: get strength, check against minimum (unless evergreen)
  strength=$(get_strength "$f")

  if is_evergreen "$f"; then
    # Evergreen lessons bypass min-strength filter
    printf '%s\t%s\t%s\n' "$score" "$base" "$strength" >> "$CANDIDATES"
  elif float_gte "$strength" "$MIN_STRENGTH"; then
    printf '%s\t%s\t%s\n' "$score" "$base" "$strength" >> "$CANDIDATES"
  fi
  # else: score >= min but strength < min and not evergreen → excluded
done

# If no candidates, output empty array
if [ ! -s "$CANDIDATES" ]; then
  echo "[]"
  exit 0
fi

# Sort by score descending (numeric), tiebreak by name
RANKED=$(sort -t$'\t' -k1,1 -rn -k2,2 "$CANDIDATES")

# Take top N
TOP_RESULTS=$(echo "$RANKED" | head -n "$TOP_N")

# Build JSON array and emit side-effects
JSON_ARRAY="["
first=1
while IFS=$'\t' read -r score base strength; do
  [ -z "$base" ] && continue
  lesson_path="$TIER0_DIR/$base"

  # Emit audit event
  emit_audit "$base"

  # Reinforce (per-session dedup)
  reinforce_lesson "$lesson_path"

  # Append to JSON
  if [ "$first" = "1" ]; then
    first=0
  else
    JSON_ARRAY="${JSON_ARRAY},"
  fi
  JSON_ARRAY="${JSON_ARRAY}{\"name\":\"${base}\",\"score\":${score},\"strength\":${strength}}"
done <<< "$TOP_RESULTS"

JSON_ARRAY="${JSON_ARRAY}]"
echo "$JSON_ARRAY"
