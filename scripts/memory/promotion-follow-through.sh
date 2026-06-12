#!/bin/bash
# E183 — Promotion Follow-Through (premature promotion detection)
#
# Scans Tier 0 lesson files in ~/.claude/template-memory/ (read-only) and
# flags lessons that were promoted >= 30 days ago but have NEVER fired
# (no retrieval signal). These are "premature promotion candidates" — likely
# targets for /athena:forget (E184).
#
# A lesson is flagged when ALL of:
#   - age >= STALE_DAYS (default 30) since `created` (frontmatter) or mtime fallback
#   - retrieval_count == 0  (E181 frontmatter, default 0 if missing)
#   - no `agent_cited` / `rule_fired` / `tier0_loaded` event for that lesson
#     in `.claude/audit.jsonl` since the promotion date (audit-log cross-check)
#
# Output:
#   default     -- markdown report to stdout
#   --json      -- JSON array of {basename, age_days, retrieval_count,
#                                 strength, proposal_path, originating_agent,
#                                 suggested_action} suitable for piping into
#                  /athena:forget (E184) or other tools
#   --quiet     -- exit 0 silently if no candidates; exit 0 with report otherwise
#
# This script is READ-ONLY. It NEVER modifies Tier 0 files. Pure detection.
#
# Usage:
#   scripts/memory/promotion-follow-through.sh                  # markdown report
#   scripts/memory/promotion-follow-through.sh --json           # JSON array
#   scripts/memory/promotion-follow-through.sh --dir <path>     # custom Tier 0 dir
#
# Env overrides (test injection):
#   TEMPLATE_MEMORY_DIR     override default ~/.claude/template-memory
#   AUDIT_LOG_PATH          override .claude/audit.jsonl
#   PROMOTION_PROPOSALS_DIR override docs/context/promotion-proposals/
#   STALE_DAYS              override the 30-day threshold (testing)
#   STRENGTH_NOW            override "today" ISO date (testing)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCORE_SH="$REPO_ROOT/scripts/memory/score.sh"
DEFAULTS_JSON="${HALF_LIFE_DEFAULTS_JSON:-$REPO_ROOT/scripts/memory/half-life-defaults.json}"
AUDIT_LOG="${AUDIT_LOG_PATH:-$REPO_ROOT/.claude/audit.jsonl}"
TIER0_DIR_DEFAULT="${TEMPLATE_MEMORY_DIR:-$HOME/.claude/template-memory}"
PROPOSALS_DIR="${PROMOTION_PROPOSALS_DIR:-$REPO_ROOT/docs/context/promotion-proposals}"
STALE_DAYS_THRESHOLD="${STALE_DAYS:-30}"

OUTPUT_FORMAT="markdown"
QUIET=0
TARGET_DIR=""

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --json)   OUTPUT_FORMAT="json"; shift ;;
    --quiet)  QUIET=1; shift ;;
    --dir)    TARGET_DIR="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "unknown arg: $1" >&2; usage ;;
  esac
done

[ -z "$TARGET_DIR" ] && TARGET_DIR="$TIER0_DIR_DEFAULT"

# ---- defensive degradation -------------------------------------------------

if [ ! -d "$TARGET_DIR" ]; then
  if [ "$OUTPUT_FORMAT" = "json" ]; then
    echo "[]"
  else
    [ "$QUIET" = "1" ] || echo "# Stale Promotions — $(date -u +%Y-%m-%d)"
    [ "$QUIET" = "1" ] || echo ""
    [ "$QUIET" = "1" ] || echo "_Tier 0 directory not found: $TARGET_DIR — skipping._"
  fi
  exit 0
fi

# ---- date helpers (portable across GNU + BSD) ------------------------------

today_iso() {
  if [ -n "${STRENGTH_NOW:-}" ]; then
    echo "$STRENGTH_NOW"
  else
    date -u +"%Y-%m-%d"
  fi
}

today_epoch() {
  local t; t=$(today_iso)
  date -u -d "$t" +%s 2>/dev/null || date -u -j -f "%Y-%m-%d" "$t" +%s 2>/dev/null
}

iso_to_epoch() {
  local d="$1"
  [ -z "$d" ] && { echo ""; return; }
  date -u -d "$d" +%s 2>/dev/null || date -u -j -f "%Y-%m-%d" "$d" +%s 2>/dev/null || \
    date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$d" +%s 2>/dev/null
}

file_mtime_iso() {
  # Portable mtime (BSD `stat -f %Sm` vs GNU `stat -c %y`).
  local f="$1"
  date -u -r "$f" +"%Y-%m-%d" 2>/dev/null || \
    stat -f "%Sm" -t "%Y-%m-%d" "$f" 2>/dev/null || \
    stat -c "%y" "$f" 2>/dev/null | awk '{print $1}'
}

# ---- frontmatter helper ----------------------------------------------------
#
# Delegate to score.sh's frontmatter helpers when possible. score.sh exposes
# `get` and `flag-weak` but not raw frontmatter access; for `created` and
# `retrieval_count` we re-implement the same minimal awk that score.sh uses.
# Per E182 QA followup, we keep the parser identical so behavior never drifts.

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

# Resolve a lesson's "promotion date" as ISO yyyy-mm-dd.
# Precedence: frontmatter `created` > file mtime.
promotion_date() {
  local file="$1"
  local d; d=$(fm_get "$file" created)
  if [ -n "$d" ]; then
    echo "$d"
    return
  fi
  file_mtime_iso "$file"
}

# Resolve retrieval_count, default 0.
retrieval_count() {
  local file="$1"
  local c; c=$(fm_get "$file" retrieval_count)
  [ -z "$c" ] && { echo 0; return; }
  if [ "$c" -eq "$c" ] 2>/dev/null; then echo "$c"; else echo 0; fi
}

# Has the audit log seen ANY retrieval event for this lesson since promotion?
# Returns 0 if YES (lesson has fired — should be excluded).
# Returns 1 if NO  (lesson is silent — candidate for flagging).
audit_log_has_retrieval_since() {
  local lesson_basename="$1" since_iso="$2"
  [ -f "$AUDIT_LOG" ] || return 1
  command -v jq >/dev/null 2>&1 || return 1
  local hit
  hit=$(jq -r --arg lesson "$lesson_basename" --arg since "$since_iso" '
    select(
      (.event == "agent_cited" or .event == "rule_fired" or .event == "tier0_loaded")
      and .lesson == $lesson
      and .ts >= $since
    ) | .ts
  ' "$AUDIT_LOG" 2>/dev/null | head -1)
  [ -n "$hit" ]
}

# Best-effort: find the original promotion proposal that introduced this
# lesson. We grep proposals_dir for the lesson basename. If multiple match,
# the earliest by filename (chronologically) wins. Returns absolute path or
# empty.
find_originating_proposal() {
  local lesson_basename="$1"
  [ -d "$PROPOSALS_DIR" ] || { echo ""; return; }
  local match
  match=$(grep -l -F "$lesson_basename" "$PROPOSALS_DIR"/*.md 2>/dev/null | sort | head -1)
  [ -z "$match" ] && { echo ""; return; }
  echo "$match"
}

# Best-effort: parse the originating agent from the proposal file. Proposals
# typically include a "(@agent)" or "Agent: @agent" hint. Returns the first
# @agent slug found, or empty.
parse_originating_agent() {
  local proposal_path="$1"
  [ -z "$proposal_path" ] || [ ! -f "$proposal_path" ] && { echo ""; return; }
  grep -oE '@[a-z][a-z0-9-]+' "$proposal_path" 2>/dev/null \
    | sort -u | head -1
}

# Best-effort: lesson strength — delegate to score.sh.
get_strength() {
  local file="$1"
  if [ -x "$SCORE_SH" ]; then
    "$SCORE_SH" get "$file" 2>/dev/null || echo ""
  else
    echo ""
  fi
}

# ---- main scan -------------------------------------------------------------

NOW_EPOCH=$(today_epoch)

# Iterate every .md file in target dir EXCEPT README/CLAUDE.md (meta files).
# We do not restrict to the half-life-defaults JSON because users may have
# additional promoted lessons (the JSON is just the "core" set).
shopt -s nullglob 2>/dev/null || true

CANDIDATES_JSON_LINES=()
CANDIDATES_MD_BLOCKS=()
COUNT=0

for path in "$TARGET_DIR"/*.md; do
  [ -f "$path" ] || continue
  base=$(basename "$path")
  case "$base" in
    README.md|CLAUDE.md) continue ;;
    *-archive-*.md|archive-*.md) continue ;;
  esac

  promo_date=$(promotion_date "$path")
  promo_epoch=$(iso_to_epoch "$promo_date")
  if [ -z "$promo_epoch" ] || [ -z "$NOW_EPOCH" ]; then
    continue
  fi
  age_days=$(( (NOW_EPOCH - promo_epoch) / 86400 ))
  [ "$age_days" -lt 0 ] && age_days=0

  # Gate 1: too young.
  if [ "$age_days" -lt "$STALE_DAYS_THRESHOLD" ]; then
    continue
  fi

  # Gate 2: retrieval_count > 0 → working as intended.
  rc=$(retrieval_count "$path")
  if [ "$rc" -gt 0 ]; then
    continue
  fi

  # Gate 3: audit log shows a retrieval since promotion → working too.
  if audit_log_has_retrieval_since "$base" "$promo_date"; then
    continue
  fi

  # Survived all gates → flag.
  COUNT=$((COUNT + 1))
  strength=$(get_strength "$path")
  proposal=$(find_originating_proposal "$base")
  agent=$(parse_originating_agent "$proposal")

  # Suggested action — for now, always /athena:forget. Future: add heuristics.
  action="/athena:forget — appears to be a premature promotion (no retrieval signals in $age_days days)"

  if [ "$OUTPUT_FORMAT" = "json" ]; then
    if command -v jq >/dev/null 2>&1; then
      line=$(jq -n -c \
        --arg basename "$base" \
        --argjson age_days "$age_days" \
        --argjson retrieval_count "$rc" \
        --arg strength "${strength:-}" \
        --arg promotion_date "$promo_date" \
        --arg proposal_path "${proposal:-}" \
        --arg originating_agent "${agent:-}" \
        --arg suggested_action "$action" \
        '{basename:$basename,age_days:$age_days,retrieval_count:$retrieval_count,strength:$strength,promotion_date:$promotion_date,proposal_path:$proposal_path,originating_agent:$originating_agent,suggested_action:$suggested_action}')
      CANDIDATES_JSON_LINES+=("$line")
    fi
  else
    {
      echo ""
      echo "### $base"
      echo "- Promoted: $promo_date ($age_days days ago)"
      echo "- Retrieval count: $rc"
      [ -n "$strength" ] && echo "- Strength score: $strength"
      if [ -n "$proposal" ]; then
        # Make the path repo-relative if possible.
        rel="${proposal#$REPO_ROOT/}"
        echo "- Original proposer: $rel"
      else
        echo "- Original proposer: _(no matching proposal in $PROPOSALS_DIR — promoted directly or before E158)_"
      fi
      [ -n "$agent" ] && echo "- Original signal: $agent"
      echo "- Suggested action: $action"
    } > "${TMPDIR:-/tmp}/e183-block-$$-$COUNT.md"
    CANDIDATES_MD_BLOCKS+=("${TMPDIR:-/tmp}/e183-block-$$-$COUNT.md")
  fi
done

# ---- emit -----------------------------------------------------------------

if [ "$OUTPUT_FORMAT" = "json" ]; then
  if [ "${#CANDIDATES_JSON_LINES[@]}" -eq 0 ]; then
    echo "[]"
  else
    # Wrap lines into a single JSON array. Guard against `jq -s` consuming
    # newline-delimited objects — we use printf + jq -s for portability.
    printf '%s\n' "${CANDIDATES_JSON_LINES[@]}" | jq -s '.'
  fi
  exit 0
fi

# Markdown branch.
if [ "$COUNT" -eq 0 ]; then
  if [ "$QUIET" = "1" ]; then
    exit 0
  fi
  echo "# Stale Promotions — $(today_iso)"
  echo ""
  echo "_No premature promotion candidates. All Tier 0 lessons either young (<${STALE_DAYS_THRESHOLD}d) or retrieved at least once since promotion._"
  exit 0
fi

echo "# Stale Promotions — $(today_iso)"
echo ""
echo "## Premature Promotion Candidates ($COUNT)"
for block in "${CANDIDATES_MD_BLOCKS[@]}"; do
  cat "$block"
  rm -f "$block"
done
echo ""
echo "---"
echo "_Threshold: $STALE_DAYS_THRESHOLD days. Detection is read-only; the human decides keep / demote / forget. Suggested action lines hint at \`/athena:forget\` (E184) but never auto-archive._"

exit 0
