#!/bin/bash
# E182 — Selective SessionStart cued-recall injector (Block B).
#
# Computes the active context cue from git, ranks every Tier 0 lesson via
# scripts/memory/match.sh, and emits a single Block B chunk to stdout for
# session-start.sh to inject after the always-on PRIMER (Block A).
#
# Cue inputs (cued recall, Ebbinghaus):
#   1. `git diff --name-only main...HEAD` — branch's changed files (path
#      prefixes feed `lesson.domains` overlap)
#   2. `git status -s`                      — uncommitted file paths
#   3. `git branch --show-current`          — branch name → branch_tag_cues
#   4. Latest commit subject                — adds informal context tags
#
# Output (stdout):
#   --- Tier 0 Cued (branch-targeted lessons) ---
#   ## <lesson basename> — score=N.NN tags=[a,b]
#   <H2 sections of the lesson, capped per-file>
#   ...
#   (footer line indicating budget consumed)
#
# Side effect: emits one `tier0_loaded` event to .claude/audit.jsonl per
# lesson actually injected (E180 contract). Empty cue (e.g. fresh clone on
# main, no diff) -> Block B is empty, no events emitted, `cat NEW_PROJECT_PRIMER`
# in session-start.sh still fires (Block A unchanged).
#
# Env overrides (test injection):
#   TEMPLATE_MEMORY_DIR    override Tier 0 dir (default ~/.claude/template-memory)
#   LESSON_TAGS_JSON       override sidecar map
#   AUDIT_LOG_PATH         override .claude/audit.jsonl (no event if jq missing)
#   E182_BUDGET_LINES      override 150-line Block B budget
#   E182_MAX_LESSONS       hard cap on # of lessons (default 8)
#   E182_FORCE_PATHS       inject these paths instead of git diff (test only)
#   E182_FORCE_BRANCH      inject this branch name (test only)
#   E182_FORCE_STATUS      inject these `git status -s`-style lines (test only)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MATCH_SH="$REPO_ROOT/scripts/memory/match.sh"
SCORE_SH="$REPO_ROOT/scripts/memory/score.sh"
SIDECAR_DEFAULT="$REPO_ROOT/scripts/memory/lesson-tags.json"
SIDECAR_JSON="${LESSON_TAGS_JSON:-$SIDECAR_DEFAULT}"
TIER0_DIR="${TEMPLATE_MEMORY_DIR:-$HOME/.claude/template-memory}"
AUDIT_LOG="${AUDIT_LOG_PATH:-$REPO_ROOT/.claude/audit.jsonl}"
BUDGET_LINES="${E182_BUDGET_LINES:-150}"
MAX_LESSONS="${E182_MAX_LESSONS:-8}"

# ---- E197: ALLOW_TIER0_WRITE isolation guard --------------------------------
# inject.sh calls score.sh reinforce internally (via emit_loaded), which
# writes strength scores back to Tier 0 files. The underlying guard in
# score.sh handles per-file checks; this guard surfaces a clear error when
# inject.sh is invoked against the real Tier 0 directory without the flag.
#
# Enforcement: if the resolved TIER0_DIR == ~/.claude/template-memory AND
# ALLOW_TIER0_WRITE != "1", exit 1 before doing any work.
# Best-effort callers (session-start.sh) use `|| true` so this never blocks.
_real_tier0=$(cd "$HOME/.claude/template-memory" 2>/dev/null && pwd || echo "")
_resolved_tier0=$(cd "$TIER0_DIR" 2>/dev/null && pwd || echo "$TIER0_DIR")
if [ -n "$_real_tier0" ] && [ "$_resolved_tier0" = "$_real_tier0" ] && \
   [ "${ALLOW_TIER0_WRITE:-}" != "1" ]; then
  echo "error: inject.sh: writing to real Tier 0 ($_real_tier0) is blocked without ALLOW_TIER0_WRITE=1" >&2
  echo "  Set ALLOW_TIER0_WRITE=1 to allow strength reinforcement writes." >&2
  echo "  Test fixtures must override TEMPLATE_MEMORY_DIR to a temp path." >&2
  exit 1
fi

# --- cue computation -------------------------------------------------------

compute_branch() {
  if [ -n "${E182_FORCE_BRANCH:-}" ]; then
    echo "$E182_FORCE_BRANCH"
    return
  fi
  git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo ""
}

compute_paths() {
  # If E182_FORCE_PATHS is defined (even if empty), respect it. The bash
  # `${var+set}` check distinguishes empty-string from unset (test mode).
  if [ -n "${E182_FORCE_PATHS+set}" ]; then
    printf '%s\n' "$E182_FORCE_PATHS"
    return
  fi
  # Diff vs main (branch may not have a merge-base — fall back to status).
  local diff_out status_out
  diff_out=$(git -C "$REPO_ROOT" diff --name-only main 2>/dev/null || true)
  status_out=$(git -C "$REPO_ROOT" status -s 2>/dev/null \
    | awk '{ if (NF >= 2) print $NF }' \
    || true)
  printf '%s\n%s\n' "$diff_out" "$status_out" | awk 'NF && !seen[$0]++'
}

# Derive tag cues from branch name + paths via the sidecar maps.
compute_tags() {
  local branch="$1" paths="$2"
  local out=""
  if [ ! -f "$SIDECAR_JSON" ] || ! command -v jq >/dev/null 2>&1; then
    return 0
  fi
  # Branch-name regex cues.
  if [ -n "$branch" ]; then
    while IFS=$'\t' read -r pattern tag; do
      [ -z "$pattern" ] && continue
      if echo "$branch" | grep -Eqi "$pattern"; then
        out=$(printf '%s\n%s' "$out" "$tag")
      fi
    done < <(jq -r '
      .branch_tag_cues // {} | to_entries[]
      | select(.key | startswith("$") | not)
      | .key as $k | .value[]? | "\($k)\t\(.)"
    ' "$SIDECAR_JSON" 2>/dev/null)
  fi
  # Path-prefix cues.
  if [ -n "$paths" ]; then
    while IFS=$'\t' read -r prefix tag; do
      [ -z "$prefix" ] && continue
      if printf '%s\n' "$paths" | awk -v p="$prefix" 'BEGIN { ok = 0 } {
        if (index($0, p) == 1 && $0 != "") ok = 1
      } END { exit (ok ? 0 : 1) }'; then
        out=$(printf '%s\n%s' "$out" "$tag")
      fi
    done < <(jq -r '
      .path_tag_cues // {} | to_entries[]
      | select(.key | startswith("$") | not)
      | .key as $k | .value[]? | "\($k)\t\(.)"
    ' "$SIDECAR_JSON" 2>/dev/null)
  fi
  # De-duplicate while preserving order.
  printf '%s\n' "$out" | awk 'NF && !seen[$0]++'
}

# Walk the Tier 0 directory; for each .md file, call match.sh and collect
# `score<TAB>filename`. Sort numeric-descending, stable on score collisions
# (tiebreak by filename for determinism).
rank_lessons() {
  local paths="$1" tags="$2"
  [ -d "$TIER0_DIR" ] || return 0
  local f
  for f in "$TIER0_DIR"/*.md; do
    [ -f "$f" ] || continue
    case "$(basename "$f")" in
      README.md|CLAUDE.md|*-archive-*) continue ;;
    esac
    local s
    s=$("$MATCH_SH" "$f" --paths "$paths" --tags "$tags" 2>/dev/null || echo "0")
    printf '%s\t%s\n' "$s" "$(basename "$f")"
  done | sort -t$'\t' -k1,1 -nr -k2,2
}

# Extract H2 sections (## ...) from a lesson file, capped at `cap` lines so
# a single lesson cannot blow the budget. Output begins with the file's
# leading H1 (if any) for orientation.
extract_excerpt() {
  local file="$1" cap="$2"
  awk -v cap="$cap" '
    BEGIN { lines = 0; in_fm = 0; fm_count = 0; printed_h1 = 0 }
    /^---[[:space:]]*$/ {
      fm_count++
      if (fm_count == 1) { in_fm = 1; next }
      if (fm_count == 2) { in_fm = 0; next }
      next
    }
    in_fm { next }
    /^# / && !printed_h1 { print; printed_h1 = 1; lines++; next }
    {
      if (lines >= cap) { print "... (truncated, see full lesson)"; exit }
      print
      lines++
    }
  ' "$file"
}

# Emit one tier0_loaded event for each lesson actually injected (E180 contract).
emit_loaded() {
  local lesson_basename="$1"
  command -v jq >/dev/null 2>&1 || return 0
  mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null
  local ts epic
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  epic=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null \
    | sed -n 's/.*\(E[0-9]\{1,\}\).*/\1/Ip' \
    | tr '[:lower:]' '[:upper:]')
  [ -z "$epic" ] && epic="none"
  jq -n -c \
    --arg ts "$ts" \
    --arg event "tier0_loaded" \
    --arg lesson "$lesson_basename" \
    --arg agent "session-start" \
    --arg epic "$epic" \
    '{ts:$ts,event:$event,lesson:$lesson,agent:$agent,epic:$epic}' \
    >> "$AUDIT_LOG" 2>/dev/null || true
  # E181: chain a strength reinforcement bump (best-effort). The dedup logic
  # in score.sh ensures multiple SessionStart injects in the same session
  # count as one bump.
  if [ -x "$SCORE_SH" ]; then
    AUDIT_LOG_PATH="$AUDIT_LOG" \
      "$SCORE_SH" reinforce "$TIER0_DIR/$lesson_basename" tier0_loaded \
      >/dev/null 2>&1 || true
  fi
}

# --- main ------------------------------------------------------------------

main() {
  [ -d "$TIER0_DIR" ] || exit 0

  local branch paths tags
  branch=$(compute_branch)
  paths=$(compute_paths)
  tags=$(compute_tags "$branch" "$paths")

  # Empty-cue fallback: if no diff AND no tags AND branch is `main`, do not
  # inject Block B at all (initial-clone UX preserved). The PRIMER (Block A)
  # in session-start.sh remains the always-on bedrock.
  local should_inject=0
  [ -n "$paths" ] && should_inject=1
  [ -n "$tags" ] && should_inject=1
  if [ "$should_inject" = "0" ]; then
    exit 0
  fi

  local ranked
  ranked=$(rank_lessons "$paths" "$tags")
  [ -z "$ranked" ] && exit 0

  echo "--- Tier 0 Cued (branch-targeted lessons) ---"

  local consumed=0 lessons=0 per_lesson_cap=$((BUDGET_LINES / 3))
  [ "$per_lesson_cap" -lt 20 ] && per_lesson_cap=20

  while IFS=$'\t' read -r score basename; do
    [ -z "$basename" ] && continue
    # Skip 0.0000 scores (no domain/tag overlap AND not evergreen).
    if awk -v s="$score" 'BEGIN { exit (s > 0.5 ? 0 : 1) }'; then
      :
    else
      continue
    fi
    if [ "$lessons" -ge "$MAX_LESSONS" ]; then break; fi
    if [ "$consumed" -ge "$BUDGET_LINES" ]; then break; fi

    local lesson_path="$TIER0_DIR/$basename"
    [ -f "$lesson_path" ] || continue

    local remaining=$((BUDGET_LINES - consumed))
    local cap=$per_lesson_cap
    [ "$cap" -gt "$remaining" ] && cap="$remaining"

    # Resolve tag list for the header (display only).
    local tag_display
    if command -v jq >/dev/null 2>&1 && [ -f "$SIDECAR_JSON" ]; then
      tag_display=$(jq -r --arg n "$basename" \
        '.defaults[$n].tags // [] | join(",")' "$SIDECAR_JSON" 2>/dev/null)
    fi

    printf '## %s — score=%s tags=[%s]\n' "$basename" "$score" "${tag_display:-}"
    extract_excerpt "$lesson_path" "$cap"
    echo ""

    local got
    got=$(extract_excerpt "$lesson_path" "$cap" | wc -l | tr -d ' ')
    consumed=$((consumed + got + 2))
    lessons=$((lessons + 1))

    emit_loaded "$basename"
  done <<< "$ranked"

  if [ "$lessons" -gt 0 ]; then
    echo "(Block B: $lessons lessons, ~$consumed lines / budget $BUDGET_LINES)"
  fi
}

main "$@"
