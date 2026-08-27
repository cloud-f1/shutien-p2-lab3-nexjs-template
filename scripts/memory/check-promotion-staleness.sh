#!/bin/bash
# E363 — Promotion-proposal staleness alarm + Tier 0 registry consistency check.
#
# This is a BLOCKING gate (unlike scripts/staleness-check.sh, which is
# advisory and always exits 0). Wired into `make verify` — do NOT wrap the
# call site with `|| true`.
#
# ── Part 1: promotion staleness ─────────────────────────────────────────────
# docs/context/promotion-proposals/ accumulates auto-generated proposal files
# (scripts/hooks/auto-promote-check.sh, E158) whenever >=3 new
# `[GENERALIZABLE]` lessons pile up. Nothing previously alerted if a proposal
# sat unreviewed. On 2026-07-13 one such proposal (22 lessons) sat for 6 weeks
# / 11 phases with zero `tier0_loaded` events before anyone noticed.
#
# IMPORTANT — why this checks the *watermark's* age, not "watermark vs. file
# timestamp": auto-promote-check.sh advances docs/context/.last-promote-ts to
# `date +%s` **the instant it writes a new proposal** (see that script's tail).
# So immediately after creation, watermark_epoch >= proposal_epoch ALWAYS —
# "has the watermark passed this file" is trivially true from the moment the
# file exists and therefore can never distinguish "reviewed" from "ignored".
# `/athena:promote --apply` rotates the SAME watermark. The watermark can only
# ever move via one of those two actions, so its own age *is* the "how long
# since anyone touched this pipeline" signal: if it hasn't moved in N+ days
# while proposal files still sit in the directory, nobody has applied (or
# re-triggered) anything in that time — which is exactly what happened for 6
# weeks in the real incident. Verified against that incident's own timeline
# (see AC #1 fixture test in scripts/memory/tests/).
#
# ── Part 2: Tier 0 registry consistency ─────────────────────────────────────
# backfill-half-life.sh, score.sh (decay-all / flag-weak), and forget.sh all
# do `jq -r '.defaults | keys[]' half-life-defaults.json` — they iterate the
# REGISTRY, not the disk. A Tier 0 *.md file that exists on disk but has no
# entry in half-life-defaults.json silently never decays, is never flagged
# weak, and is never archived by /athena:forget — no error, just permanently
# outside the E181/E184 lifecycle. This part reports (and blocks on) exactly
# that direction of mismatch. It does NOT block on a registry entry that has
# no file on disk yet (e.g. a lesson name reserved for a future promotion) —
# that's harmless, there's no file to fall out of a lifecycle.
# It also advisory-reports (non-blocking) disk files missing from
# lesson-tags.json, used by match.sh for retrieval-relevance scoring; a
# missing entry degrades scoring (falls back to a lesson's own frontmatter,
# or empty) rather than removing the file from a lifecycle entirely, so it
# is not gate-blocking. NEW_PROJECT_PRIMER.md is exempt from that advisory —
# it is the always-on curated digest, already excluded from tag/domain
# scoring by convention elsewhere (inject.sh / consolidation-detect.sh /
# metrics.sh all skip it explicitly).
#
# Usage:
#   scripts/memory/check-promotion-staleness.sh                  # both checks
#   scripts/memory/check-promotion-staleness.sh --staleness-only
#   scripts/memory/check-promotion-staleness.sh --registry-only
#   scripts/memory/check-promotion-staleness.sh --days 14         # override N
#
# Env overrides (test injection):
#   PROMOTION_PROPOSALS_DIR   default docs/context/promotion-proposals
#   PROMOTION_WATERMARK_FILE  default docs/context/.last-promote-ts
#   PROMOTION_STALENESS_DAYS  default 14 (same as --days)
#   STALENESS_NOW_EPOCH       override "now" epoch (testing determinism)
#   TEMPLATE_MEMORY_DIR       override Tier 0 dir (~/.claude/template-memory)
#   LESSON_TAGS_JSON          override lesson-tags.json path
#   HALF_LIFE_DEFAULTS_JSON   override half-life-defaults.json path
#
# Exit codes:
#   0  clean
#   1  stale promotion proposal(s) — watermark hasn't moved in N+ days
#   2  Tier 0 registry drift — a disk file is missing from half-life-defaults.json
#   3  both

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

STALENESS_ONLY=0
REGISTRY_ONLY=0
DAYS="${PROMOTION_STALENESS_DAYS:-14}"
PROPOSALS_DIR="${PROMOTION_PROPOSALS_DIR:-$REPO_ROOT/docs/context/promotion-proposals}"
WATERMARK_FILE="${PROMOTION_WATERMARK_FILE:-$REPO_ROOT/docs/context/.last-promote-ts}"
TIER0_DIR="${TEMPLATE_MEMORY_DIR:-$HOME/.claude/template-memory}"
LESSON_TAGS_JSON="${LESSON_TAGS_JSON:-$REPO_ROOT/scripts/memory/lesson-tags.json}"
HALF_LIFE_DEFAULTS_JSON="${HALF_LIFE_DEFAULTS_JSON:-$REPO_ROOT/scripts/memory/half-life-defaults.json}"

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --staleness-only) STALENESS_ONLY=1; shift ;;
    --registry-only)  REGISTRY_ONLY=1; shift ;;
    --days)           DAYS="$2"; shift 2 ;;
    -h|--help)        usage ;;
    *) echo "unknown arg: $1" >&2; usage ;;
  esac
done

# ---- date helpers (portable across GNU + BSD) ------------------------------

now_epoch() {
  if [ -n "${STALENESS_NOW_EPOCH:-}" ]; then
    echo "$STALENESS_NOW_EPOCH"
  else
    date -u +%s
  fi
}

epoch_to_iso() {
  local e="$1"
  date -u -d "@$e" +"%Y-%m-%d %H:%M:%SZ" 2>/dev/null || \
    date -u -r "$e" +"%Y-%m-%d %H:%M:%SZ" 2>/dev/null || \
    echo "epoch:$e"
}

# Parse a strict `YYYYMMDD-HHMMSS.md` basename (the auto-promote-check.sh
# naming convention) into an epoch. Echoes epoch and returns 0, or returns 1
# if the basename doesn't match that exact shape (caller falls back to mtime).
parse_filename_epoch() {
  local base="$1"
  case "$base" in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9].md)
      local y="${base:0:4}" mo="${base:4:2}" d="${base:6:2}"
      local h="${base:9:2}" mi="${base:11:2}" s="${base:13:2}"
      local iso="${y}-${mo}-${d} ${h}:${mi}:${s}"
      local epoch
      epoch=$(date -u -d "$iso" +%s 2>/dev/null)
      if [ -z "$epoch" ]; then
        epoch=$(date -u -j -f "%Y-%m-%d %H:%M:%S" "$iso" +%s 2>/dev/null)
      fi
      [ -n "$epoch" ] && { echo "$epoch"; return 0; }
      return 1
      ;;
    *) return 1 ;;
  esac
}

# Portable file mtime epoch (fallback for non-conforming filenames — a fresh
# `git checkout`/worktree resets mtime to checkout time, so this is only a
# fallback, never the primary signal for files that follow the naming
# convention).
file_mtime_epoch() {
  local f="$1"
  date -u -r "$f" +%s 2>/dev/null || stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null
}

proposal_epoch() {
  local path="$1" base epoch
  base=$(basename "$path")
  if epoch=$(parse_filename_epoch "$base"); then
    echo "$epoch"
    return
  fi
  file_mtime_epoch "$path"
}

read_watermark_epoch() {
  local wf="$1"
  [ -f "$wf" ] || { echo 0; return; }
  local v
  v=$(tr -d '[:space:]' < "$wf" 2>/dev/null)
  if printf '%s' "$v" | grep -qE '^[0-9]+$'; then
    echo "$v"
  else
    echo 0
  fi
}

# ---- Part 1: promotion staleness -------------------------------------------

run_staleness_check() {
  local dir="$1" days="$2" watermark_file="$3" now="$4"

  if [ ! -d "$dir" ]; then
    echo "  - proposals dir not found: $dir (skipping staleness check)"
    return 0
  fi

  local files=()
  local f base
  for f in "$dir"/*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    case "$base" in
      README.md) continue ;;
    esac
    files+=("$f")
  done

  if [ "${#files[@]}" -eq 0 ]; then
    echo "  OK - no pending promotion proposals in $dir."
    return 0
  fi

  local watermark_epoch
  watermark_epoch=$(read_watermark_epoch "$watermark_file")
  local watermark_age_days=$(( (now - watermark_epoch) / 86400 ))
  [ "$watermark_age_days" -lt 0 ] && watermark_age_days=0

  if [ "$watermark_age_days" -le "$days" ]; then
    echo "  OK - promotion watermark is fresh (${watermark_age_days}d old, threshold ${days}d) -- ${#files[@]} proposal file(s) on disk, presumed reviewed/applied."
    return 0
  fi

  echo "  STALE - promotion watermark has not advanced in ${watermark_age_days} day(s) (threshold ${days}d)."
  echo "      watermark file : $watermark_file"
  echo "      watermark date : $(epoch_to_iso "$watermark_epoch")"
  echo "      Proposal file(s) sitting since (at/before) that watermark with no visible follow-up:"
  for f in "${files[@]}"; do
    base=$(basename "$f")
    local epoch; epoch=$(proposal_epoch "$f")
    echo "        - $base (created $(epoch_to_iso "$epoch"))"
  done
  echo "      -> review:  /athena:promote --dry-run"
  echo "      -> apply :  /athena:promote --apply <proposal-path>"
  echo "      See docs/context/promotion-proposals/README.md"
  return 1
}

# ---- Part 2: Tier 0 registry consistency -----------------------------------

run_registry_check() {
  local tier0_dir="$1" lesson_tags_json="$2" half_life_json="$3"

  if [ ! -d "$tier0_dir" ]; then
    echo "  - Tier 0 dir not found: $tier0_dir (skipping registry check)"
    return 0
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "  - jq not found -- skipping registry check"
    return 0
  fi
  if [ ! -f "$lesson_tags_json" ]; then
    echo "  DRIFT - lesson-tags.json missing: $lesson_tags_json"
    return 1
  fi
  if [ ! -f "$half_life_json" ]; then
    echo "  DRIFT - half-life-defaults.json missing: $half_life_json"
    return 1
  fi

  local half_life_keys lesson_tags_keys
  half_life_keys=$(jq -r '.defaults | keys[]' "$half_life_json")
  lesson_tags_keys=$(jq -r '.defaults | keys[]' "$lesson_tags_json")

  local missing_half_life=() missing_lesson_tags=()
  local f base
  for f in "$tier0_dir"/*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    case "$base" in
      README.md|CLAUDE.md) continue ;;
    esac

    if ! printf '%s\n' "$half_life_keys" | grep -qxF "$base"; then
      missing_half_life+=("$base")
    fi

    case "$base" in
      NEW_PROJECT_PRIMER.md) : ;; # exempt — always-on digest, not tag/domain scored (see inject.sh)
      *)
        if ! printf '%s\n' "$lesson_tags_keys" | grep -qxF "$base"; then
          missing_lesson_tags+=("$base")
        fi
        ;;
    esac
  done

  local rc=0
  if [ "${#missing_half_life[@]}" -gt 0 ]; then
    echo "  DRIFT - missing from half-life-defaults.json (will NEVER decay / never flag-weak / never be archived by forget.sh -- silently outside the E181/E184 lifecycle):"
    for base in "${missing_half_life[@]}"; do echo "        - $base"; done
    rc=1
  else
    echo "  OK - every Tier 0 disk file is registered in half-life-defaults.json."
  fi

  if [ "${#missing_lesson_tags[@]}" -gt 0 ]; then
    echo "  ADVISORY - missing from lesson-tags.json (match.sh falls back to empty tags/domains unless the file's own frontmatter sets them; not gate-blocking):"
    for base in "${missing_lesson_tags[@]}"; do echo "        - $base"; done
  fi

  return $rc
}

# ---- main -------------------------------------------------------------------

echo "=== E363 -- promotion staleness + Tier 0 registry check ==="

STALE_RC=0
REGISTRY_RC=0

if [ "$REGISTRY_ONLY" != "1" ]; then
  echo ""
  echo "[1/2] Promotion proposal staleness (threshold: ${DAYS}d)"
  NOW="$(now_epoch)"
  run_staleness_check "$PROPOSALS_DIR" "$DAYS" "$WATERMARK_FILE" "$NOW" || STALE_RC=1
fi

if [ "$STALENESS_ONLY" != "1" ]; then
  echo ""
  echo "[2/2] Tier 0 registry consistency (lesson-tags.json / half-life-defaults.json / disk)"
  run_registry_check "$TIER0_DIR" "$LESSON_TAGS_JSON" "$HALF_LIFE_DEFAULTS_JSON" || REGISTRY_RC=1
fi

echo ""
if [ "$STALE_RC" -eq 0 ] && [ "$REGISTRY_RC" -eq 0 ]; then
  echo "PASS - check-promotion-staleness: clean."
  exit 0
fi

echo "FAIL - check-promotion-staleness (staleness=$STALE_RC, registry=$REGISTRY_RC)."
echo "This is a BLOCKING gate (make verify) -- see docs/epics/e363-tier0-staleness-and-registry.md."

if [ "$STALE_RC" -ne 0 ] && [ "$REGISTRY_RC" -ne 0 ]; then exit 3; fi
if [ "$REGISTRY_RC" -ne 0 ]; then exit 2; fi
exit 1
