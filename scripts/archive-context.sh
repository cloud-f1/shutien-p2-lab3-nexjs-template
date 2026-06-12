#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# archive-context.sh — E160 context log auto-compact + auto-promotion pipeline
#                      E196: H3-heading support for orchestration-log.md
#
# Stop hook (and manual command). Archives over-limit entry sections in
# docs/context/*.md to docs/context/archive/<YYYY-MM>.md, after first
# extracting any [GENERALIZABLE] lines from the about-to-be-archived sections
# into a docs/context/promotion-proposals/archive-<ts>.md (shared format with
# the E158 auto-promote-check.sh hook). Per-file limits live in the LIMITS
# table below; qa-patterns.md is intentionally absent (curated, never
# archived). Telemetry is appended to .claude/audit.jsonl as auto_compact.
#
# E196 fix: some files (orchestration-log.md) use ### (H3) as their entry
# heading under a top-level ## section. The HEADING_DEPTH array controls
# whether a file's entries are counted at H2 (##) or H3 (###) depth.
# A depth of 2 → count ## headings; depth of 3 → count ### headings.
#
# Usage:
#   archive-context.sh --check   # dry-run; prints over-limit files; exits 1 if any
#   archive-context.sh --auto    # silent, hook-safe; extracts + archives
#   archive-context.sh           # interactive (same as --auto + summary)
#
# Test overrides (for scripts/archive-context-tests/):
#   ARCHIVE_ROOT          — override docs/context path
#   ARCHIVE_AUDIT_LOG     — override .claude/audit.jsonl path
#   ARCHIVE_H3_FILES      — space-separated filenames to treat as H3 depth
#   ARCHIVE_TEST_LIMITS   — space-separated "filename:limit" overrides
#
# Exit policy: -uo pipefail (NOT -e). Always exits cleanly even on partial
# failures so the Stop hook never blocks completion. --check is the only mode
# that may exit non-zero (intentional dry-run signal).
# -----------------------------------------------------------------------------
set -uo pipefail

# Per-file entry limits. qa-patterns.md is NOT in this list by design
# (curated patterns are load-bearing). Three parallel arrays so this works on
# macOS's bash 3.2 (no associative-array support).
#
# HEADING_DEPTH: 2 = count ## headings (default); 3 = count ### headings.
# orchestration-log.md uses H3 entries under 2 H2 headers — if counted at H2
# depth the script would always see only 2 entries and never trigger archival.
LIMIT_FILES=(
  "debug-log.md"
  "review-findings.md"
  "deploy-log.md"
  "orchestration-log.md"
  "evaluation-log.md"
  "health-log.md"
  "session-summary.md"
)
LIMIT_VALUES=(
  20
  15
  30
  50
  20
  50
  5
)
# Heading depth per file: 2=H2, 3=H3
HEADING_DEPTH=(
  2
  2
  2
  3
  2
  2
  2
)

CHECK_ONLY=0
AUTO=0
case "${1:-}" in
  --check) CHECK_ONLY=1 ;;
  --auto)  AUTO=1 ;;
  "")      ;;
  *) printf 'Unknown flag: %s\n' "$1" >&2; exit 0 ;;
esac

# Resolve repo root; bail quietly if not in a git checkout (matches E158 hook).
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$repo_root" ]]; then
  cd "$repo_root" || exit 0
fi

# Allow test overrides for ARCHIVE_ROOT and ARCHIVE_AUDIT_LOG.
root="${ARCHIVE_ROOT:-docs/context}"
[[ -d "$root" ]] || exit 0

archive_dir="$root/archive"
mkdir -p "$archive_dir" 2>/dev/null || true

month=$(date +%Y-%m 2>/dev/null || echo "unknown")
archive_file="$archive_dir/${month}.md"

proposal_dir="$root/promotion-proposals"
audit_log="${ARCHIVE_AUDIT_LOG:-.claude/audit.jsonl}"

# Apply ARCHIVE_TEST_LIMITS overrides ("filename:limit" space-separated).
# This lets tests inject a small limit without editing the arrays.
if [[ -n "${ARCHIVE_TEST_LIMITS:-}" ]]; then
  for override in $ARCHIVE_TEST_LIMITS; do
    ovr_file="${override%%:*}"
    ovr_limit="${override##*:}"
    idx=0
    while (( idx < ${#LIMIT_FILES[@]} )); do
      if [[ "${LIMIT_FILES[$idx]}" = "$ovr_file" ]]; then
        LIMIT_VALUES[$idx]="$ovr_limit"
        break
      fi
      idx=$((idx + 1))
    done
  done
fi

# Apply ARCHIVE_H3_FILES overrides (space-separated filenames to treat as H3).
if [[ -n "${ARCHIVE_H3_FILES:-}" ]]; then
  for h3_file in $ARCHIVE_H3_FILES; do
    idx=0
    while (( idx < ${#LIMIT_FILES[@]} )); do
      if [[ "${LIMIT_FILES[$idx]}" = "$h3_file" ]]; then
        HEADING_DEPTH[$idx]=3
        break
      fi
      idx=$((idx + 1))
    done
  done
fi

# Extract [GENERALIZABLE] lines from entry sections about to be archived (the
# oldest `cutoff` entries) and write a promotion proposal in the E158-shared
# format. Returns 0 always.
# $4 = heading depth (2 for H2, 3 for H3)
extract_lessons_before_archive() {
  local file="$1" limit="$2" entries="$3" depth="${4:-2}"
  local cutoff=$((entries - limit))
  (( cutoff > 0 )) || return 0

  # Build the heading pattern for the given depth
  local heading_pat
  if [[ "$depth" -eq 3 ]]; then
    heading_pat='^### '
  else
    heading_pat='^## '
  fi

  mkdir -p "$proposal_dir" 2>/dev/null || true
  local ts
  ts=$(date +%Y%m%d-%H%M%S 2>/dev/null || echo "unknown")
  local proposal="$proposal_dir/archive-${ts}.md"
  local tmp="$proposal.tmp"

  awk -v cutoff="$cutoff" -v pat="$heading_pat" '
    $0 ~ pat { h_count++ }
    h_count <= cutoff && /\[GENERALIZABLE\]/ { print FILENAME ":" NR ": " $0 }
  ' "$file" > "$tmp" 2>/dev/null || true

  if [[ -s "$tmp" ]]; then
    {
      echo "# Promotion Proposal — ${ts} (from archive flow)"
      echo
      echo "Auto-generated by \`scripts/archive-context.sh\` before archiving the oldest"
      echo "${cutoff} heading-depth-${depth} section(s) of \`${file}\`. Same format as E158 auto-promote."
      echo
      echo "## Next step"
      echo
      echo "\`/athena:promote --apply ${proposal}\`"
      echo
      echo "## Pending lessons (about to be archived)"
      echo
      cat "$tmp"
    } > "$proposal" 2>/dev/null || true
  fi
  rm -f "$tmp" 2>/dev/null || true
}

# Split a file in place: keep the last $limit entry sections live, append the rest
# (including any preamble before the first entry heading) to $archive_file via a
# single awk pass. The live file is rewritten atomically via a .new sibling.
# $3 = heading depth (2 for H2, 3 for H3)
split_file_at_heading() {
  local file="$1" limit="$2" depth="${3:-2}"
  local tmp_new="$file.new"
  local tmp_arch; tmp_arch=$(mktemp 2>/dev/null || echo "$file.arch.$$")

  # Build the heading pattern for the given depth
  local heading_pat
  if [[ "$depth" -eq 3 ]]; then
    heading_pat='^### '
  else
    heading_pat='^## '
  fi

  awk -v limit="$limit" -v archive="$tmp_arch" -v pat="$heading_pat" '
    $0 ~ pat { h_count++ }
    { lines[NR]=$0; at[NR]=h_count }
    END {
      cutoff = h_count - limit
      if (cutoff < 0) cutoff = 0
      for (i=1; i<=NR; i++) {
        if (at[i] <= cutoff && cutoff > 0) print lines[i] >> archive
        else                                print lines[i]
      }
    }
  ' "$file" > "$tmp_new" 2>/dev/null

  if [[ -s "$tmp_arch" ]]; then
    {
      echo
      echo "<!-- archived from $file at $(date -u +%FT%TZ 2>/dev/null || echo unknown) -->"
      cat "$tmp_arch"
    } >> "$archive_file" 2>/dev/null || true
  fi
  rm -f "$tmp_arch" 2>/dev/null || true
  mv "$tmp_new" "$file" 2>/dev/null || rm -f "$tmp_new" 2>/dev/null
}

# Backward-compat alias for callers using the old name (H2 only).
split_file_at_h2() {
  split_file_at_heading "$1" "$2" 2
}

over_limit=0
archived_files=()

# Iterate by index so we can read parallel arrays (bash 3.2 has no assoc arrays).
i=0
while (( i < ${#LIMIT_FILES[@]} )); do
  fname="${LIMIT_FILES[$i]}"
  limit="${LIMIT_VALUES[$i]}"
  depth="${HEADING_DEPTH[$i]:-2}"
  i=$((i + 1))
  file="$root/$fname"
  [[ -f "$file" ]] || continue

  # Count entry headings at the configured depth.
  # depth=2 → count ## headings; depth=3 → count ### headings.
  if [[ "$depth" -eq 3 ]]; then
    entries=$(grep -cE '^### ' "$file" 2>/dev/null || true)
  else
    entries=$(grep -cE '^## ' "$file" 2>/dev/null || true)
  fi
  entries=${entries:-0}
  [[ "$entries" =~ ^[0-9]+$ ]] || entries=0

  if (( entries > limit )); then
    over_limit=$((over_limit + 1))
    if (( CHECK_ONLY == 1 )); then
      printf 'over-limit: %s (%d entries at H%d depth, limit %d)\n' "$fname" "$entries" "$depth" "$limit"
      continue
    fi

    (( AUTO == 0 )) && printf 'archiving: %s (%d entries at H%d depth, limit %d)\n' "$fname" "$entries" "$depth" "$limit"

    # 1. Extract [GENERALIZABLE] lines from soon-to-archive sections.
    extract_lessons_before_archive "$file" "$limit" "$entries" "$depth"

    # 2. Split + rewrite the live file; append archived sections to month file.
    split_file_at_heading "$file" "$limit" "$depth"

    archived_count=$((entries - limit))
    archived_files+=("$fname:$archived_count")

    # 3. Telemetry.
    iso_ts=$(date -u +%FT%TZ 2>/dev/null || date -u '+%Y-%m-%dT%H:%M:%SZ')
    mkdir -p "$(dirname "$audit_log")" 2>/dev/null || true
    printf '{"ts":"%s","event":"auto_compact","file":"%s","archived_entries":%d,"limit":%d,"heading_depth":%d}\n' \
      "$iso_ts" "$fname" "$archived_count" "$limit" "$depth" >> "$audit_log" 2>/dev/null || true
  fi
done

# --check mode: exit 1 if any file is over limit (so /athena:save can nudge).
if (( CHECK_ONLY == 1 )); then
  if (( over_limit > 0 )); then
    exit 1
  fi
  exit 0
fi

# Interactive (default) mode: print summary so the human knows what happened.
if (( AUTO == 0 )); then
  if (( ${#archived_files[@]} > 0 )); then
    printf '\nSummary: archived %d file(s) to %s\n' "${#archived_files[@]}" "$archive_file"
    for entry in "${archived_files[@]}"; do
      printf '  - %s\n' "$entry"
    done
    printf '\nReview promotion proposals in %s/ before running /athena:promote.\n' "$proposal_dir"
  else
    printf 'No files over limit. Nothing to archive.\n'
  fi
fi

# Always exit 0 in --auto and default modes (Stop hook must never block).
exit 0
