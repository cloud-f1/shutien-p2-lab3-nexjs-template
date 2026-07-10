#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# render-index.sh — E196 render EPIC_INDEX.md from epic-progress.md
#
# Reads epic-progress.md as the single source of truth and regenerates two
# sections of EPIC_INDEX.md in-place:
#   1. Phase Status table  (between <!-- PHASE_STATUS_START --> and <!-- PHASE_STATUS_END -->)
#   2. Epic Step Matrix    (between <!-- EPIC_MATRIX_START --> and <!-- EPIC_MATRIX_END -->)
#
# All prose outside these sentinel blocks (Dependency Rules, Phase Parallelism,
# Next Action, etc.) is extracted verbatim and reinjected — never regenerated.
#
# Prose-preserving MERGE (not replace): epic-progress.md and EPIC_INDEX.md are
# asymmetric — epic-progress rows are lean state ("✅ Complete"), EPIC_INDEX
# rows often carry rich historical prose ("✅ Complete (Backport Wave 2 — ...)")
# and each file may have rows the other lacks. A naive full-replace regen would
# wipe that prose and drop history-only rows. The merge rules:
#
#   Phase Status table (per phase row, keyed by the Phase/Infra cell):
#     1. Row in both files: if EPIC_INDEX's existing Status cell *starts with*
#        epic-progress's Status cell, keep the existing (rich) Status cell —
#        prose preserved. Otherwise the status actually changed, so
#        epic-progress's Status cell wins (state wins over stale prose). Either
#        way the row's position in EPIC_INDEX is kept, and the Epics cell
#        always comes from epic-progress (state is authoritative for which
#        epics belong to a phase).
#     2. Row only in EPIC_INDEX: preserved verbatim, in place — history is
#        never deleted.
#     3. Row only in epic-progress: appended (current behavior for new rows).
#
#   Epic Step Matrix (per epic row, keyed by the Epic cell):
#     Step cells (Spec/Impl/QA/Commit/Merge) always come from epic-progress
#     (state). The Notes cell: if epic-progress's Notes is a prefix of
#     EPIC_INDEX's existing Notes, keep the existing (richer) Notes; otherwise
#     epic-progress's Notes wins. Rows only in EPIC_INDEX are preserved in
#     place; rows only in epic-progress are appended.
#
# Idempotent: running twice on the same file pair produces identical output
# (a merged rich row already satisfies "starts with" against itself).
#
# Environment overrides (for testing):
#   PROGRESS_FILE  — path to epic-progress.md (default: docs/context/epic-progress.md)
#   INDEX_FILE     — path to EPIC_INDEX.md    (default: docs/epics/EPIC_INDEX.md)
#
# Usage:
#   scripts/state/render-index.sh
#   PROGRESS_FILE=... INDEX_FILE=... scripts/state/render-index.sh
#
# Exit policy: exits 0 always (safe to call from loop/batch).
# -----------------------------------------------------------------------------
set -uo pipefail

# Resolve repo root
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$repo_root" ]]; then
  cd "$repo_root" || true
fi

PROGRESS_FILE="${PROGRESS_FILE:-docs/context/epic-progress.md}"
INDEX_FILE="${INDEX_FILE:-docs/epics/EPIC_INDEX.md}"

if [[ ! -f "$PROGRESS_FILE" ]]; then
  printf 'render-index.sh: PROGRESS_FILE not found: %s\n' "$PROGRESS_FILE" >&2
  exit 0
fi

if [[ ! -f "$INDEX_FILE" ]]; then
  printf 'render-index.sh: INDEX_FILE not found: %s\n' "$INDEX_FILE" >&2
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 1: Extract Phase Status table from epic-progress.md (source of truth
# for STATE). Collect rows between "## Phase Status" and the next "## "
# heading. Output format: | Phase N | E1, E2 | ✅ Complete |
# ---------------------------------------------------------------------------
phase_rows=$(awk '
  /^## Phase Status/ { in_section=1; next }
  in_section && /^\| Phase [0-9]/ { print; next }
  in_section && /^\| Infra/ { print; next }
  in_section && /^\|/ { next }
  in_section && /^## / { exit }
  in_section { next }
' "$PROGRESS_FILE" 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Step 2: Extract Epic Step Matrix from epic-progress.md (source of truth for
# STATE). Collect rows between "## Epic Step Matrix" and the next "## "
# heading. Emit only epic data rows (lines starting with | E).
# ---------------------------------------------------------------------------
matrix_rows=$(awk '
  /^## Epic Step Matrix/ { in_section=1; next }
  in_section && /^\| E[0-9]/ { print; next }
  in_section && /^\|/ { next }
  in_section && /^## / { exit }
  in_section { next }
' "$PROGRESS_FILE" 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Step 3: Ensure sentinel comments exist in INDEX_FILE. If absent, inject them
# around the first occurrence of the Phase Status and Epic Step Matrix tables
# so the merge/splice logic below always has sentinels to work with.
# ---------------------------------------------------------------------------
has_phase_sentinel=0
has_matrix_sentinel=0
grep -q '<!-- PHASE_STATUS_START -->' "$INDEX_FILE" 2>/dev/null && has_phase_sentinel=1 || true
grep -q '<!-- EPIC_MATRIX_START -->' "$INDEX_FILE" 2>/dev/null && has_matrix_sentinel=1 || true

tmp_index="$INDEX_FILE.render.tmp"

if [[ "$has_phase_sentinel" -eq 0 ]] || [[ "$has_matrix_sentinel" -eq 0 ]]; then
  awk '
    /^## Phase Status/ && !phase_done {
      print "<!-- PHASE_STATUS_START -->"
      phase_open=1
    }
    phase_open && /^## / && !/^## Phase Status/ {
      printf "<!-- PHASE_STATUS_END -->\n\n"
      phase_open=0
      phase_done=1
    }
    /^## Epic Step Matrix/ && !matrix_done {
      if (phase_open) {
        printf "<!-- PHASE_STATUS_END -->\n\n"
        phase_open=0
        phase_done=1
      }
      print "<!-- EPIC_MATRIX_START -->"
      matrix_open=1
    }
    matrix_open && /^## / && !/^## Epic Step Matrix/ {
      printf "<!-- EPIC_MATRIX_END -->\n\n"
      matrix_open=0
      matrix_done=1
    }
    { print }
    END {
      if (phase_open) print "<!-- PHASE_STATUS_END -->"
      if (matrix_open) print "<!-- EPIC_MATRIX_END -->"
    }
  ' "$INDEX_FILE" > "$tmp_index" 2>/dev/null && mv "$tmp_index" "$INDEX_FILE"
fi

# ---------------------------------------------------------------------------
# Step 4: Extract the CURRENT (pre-render) EPIC_INDEX.md rows between
# sentinels — this is the "rich" side of the merge.
# ---------------------------------------------------------------------------
existing_phase_rows=$(awk '
  /<!-- PHASE_STATUS_START -->/ { in_section=1; next }
  /<!-- PHASE_STATUS_END -->/ { exit }
  in_section && /^\| Phase [0-9]/ { print; next }
  in_section && /^\| Infra/ { print; next }
' "$INDEX_FILE" 2>/dev/null || true)

existing_matrix_rows=$(awk '
  /<!-- EPIC_MATRIX_START -->/ { in_section=1; next }
  /<!-- EPIC_MATRIX_END -->/ { exit }
  in_section && /^\| E[0-9]/ { print; next }
' "$INDEX_FILE" 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Step 5: Merge. Write progress (state) rows and existing (rich) rows to temp
# files, then run an awk merge pass per the rules documented at the top of
# this file. bash 3.2 / BSD awk compatible — no gawk-only features.
# ---------------------------------------------------------------------------
prog_phase_tmp=$(mktemp 2>/dev/null || echo "/tmp/render_prog_phase.$$")
idx_phase_tmp=$(mktemp 2>/dev/null || echo "/tmp/render_idx_phase.$$")
prog_matrix_tmp=$(mktemp 2>/dev/null || echo "/tmp/render_prog_matrix.$$")
idx_matrix_tmp=$(mktemp 2>/dev/null || echo "/tmp/render_idx_matrix.$$")

printf '%s\n' "$phase_rows" > "$prog_phase_tmp"
printf '%s\n' "$existing_phase_rows" > "$idx_phase_tmp"
printf '%s\n' "$matrix_rows" > "$prog_matrix_tmp"
printf '%s\n' "$existing_matrix_rows" > "$idx_matrix_tmp"

merged_phase_rows=$(awk -v prog_file="$prog_phase_tmp" '
  function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  # Rejoin fields [start..nf] with "|" — the Status cell (or any tail cell) may
  # itself contain a literal "|" (e.g. markdown-escaped "\|" in prose), which
  # a naive single-field lookup after split() would silently truncate.
  # end is nf-1: a well-formed table row always ends with "|" as its last
  # character, so split() always yields one guaranteed-empty trailing field
  # after the final delimiter — that field must be dropped, not joined back in.
  function join_from(arr, start, end,    result, i) {
    result = arr[start]
    for (i = start + 1; i <= end; i++) result = result "|" arr[i]
    return result
  }
  BEGIN {
    FS = "|"
    n = 0
    while ((getline line < prog_file) > 0) {
      if (line == "") continue
      nf = split(line, f, "|")
      key = trim(f[2])
      n++
      porder[n] = key
      pepics[key] = trim(f[3])
      pstatus[key] = trim(join_from(f, 4, nf - 1))
      prow[key] = line
      pused[key] = 0
    }
    close(prog_file)
  }
  {
    if ($0 == "") next
    nf = split($0, f, "|")
    key = trim(f[2])
    istatus = trim(join_from(f, 4, nf - 1))
    if (key in pused) {
      pused[key] = 1
      ne = pepics[key]
      ns = pstatus[key]
      if (index(istatus, ns) == 1) {
        printf "| %s | %s | %s |\n", key, ne, istatus
      } else {
        printf "| %s | %s | %s |\n", key, ne, ns
      }
    } else {
      print $0
    }
  }
  END {
    for (i = 1; i <= n; i++) {
      k = porder[i]
      if (!pused[k]) print prow[k]
    }
  }
' "$idx_phase_tmp" 2>/dev/null || true)

merged_matrix_rows=$(awk -v prog_file="$prog_matrix_tmp" '
  function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  # end is nf-1: a well-formed table row always ends with "|" as its last
  # character, so split() always yields one guaranteed-empty trailing field
  # after the final delimiter — that field must be dropped, not joined back in.
  function join_from(arr, start, end,    result, i) {
    result = arr[start]
    for (i = start + 1; i <= end; i++) result = result "|" arr[i]
    return result
  }
  BEGIN {
    FS = "|"
    n = 0
    while ((getline line < prog_file) > 0) {
      if (line == "") continue
      nf = split(line, f, "|")
      key = trim(f[2])
      n++
      porder[n] = key
      pspec[key] = trim(f[3]); pimpl[key] = trim(f[4]); pqa[key] = trim(f[5])
      pcommit[key] = trim(f[6]); pmerge[key] = trim(f[7]); pnotes[key] = trim(join_from(f, 8, nf - 1))
      prow[key] = line
      pused[key] = 0
    }
    close(prog_file)
  }
  {
    if ($0 == "") next
    nf = split($0, f, "|")
    key = trim(f[2])
    inotes = trim(join_from(f, 8, nf - 1))
    if (key in pused) {
      pused[key] = 1
      nn = pnotes[key]
      if (index(inotes, nn) == 1) {
        finalnotes = inotes
      } else {
        finalnotes = nn
      }
      printf "| %s | %s | %s | %s | %s | %s | %s |\n", key, pspec[key], pimpl[key], pqa[key], pcommit[key], pmerge[key], finalnotes
    } else {
      print $0
    }
  }
  END {
    for (i = 1; i <= n; i++) {
      k = porder[i]
      if (!pused[k]) print prow[k]
    }
  }
' "$idx_matrix_tmp" 2>/dev/null || true)

rm -f "$prog_phase_tmp" "$idx_phase_tmp" "$prog_matrix_tmp" "$idx_matrix_tmp"

# ---------------------------------------------------------------------------
# Step 6: Splice merged sections into INDEX_FILE between sentinel comments.
# ---------------------------------------------------------------------------
phase_tmp=$(mktemp 2>/dev/null || echo "/tmp/render_phase.$$")
matrix_tmp=$(mktemp 2>/dev/null || echo "/tmp/render_matrix.$$")

printf '%s\n' "$merged_phase_rows" > "$phase_tmp"
printf '%s\n' "$merged_matrix_rows" > "$matrix_tmp"

awk -v phase_file="$phase_tmp" -v matrix_file="$matrix_tmp" '
  # Track which section we are in
  /<!-- PHASE_STATUS_START -->/ {
    print
    in_phase=1
    # Print the regenerated Phase Status table
    print "## Phase Status"
    print ""
    print "| Phase | Epics | Status |"
    print "|-------|-------|--------|"
    while ((getline line < phase_file) > 0) {
      print line
    }
    close(phase_file)
    next
  }
  /<!-- PHASE_STATUS_END -->/ {
    in_phase=0
    print
    next
  }
  in_phase { next }  # skip old content between sentinels

  /<!-- EPIC_MATRIX_START -->/ {
    print
    in_matrix=1
    # Print the regenerated Epic Step Matrix
    print "## Epic Step Matrix"
    print ""
    print "<!--"
    print "Steps: spec \342\206\222 implement \342\206\222 qa \342\206\222 commit \342\206\222 merge"
    print "Status: \342\254\234 pending | \360\237\224\204 in-progress | \342\234\205 done | \342\217\255\357\270\217 skip | \342\235\214 failed"
    print "Size: S (~1 session) | M (1-2 sessions) | L (2-3 sessions) - lives in the `size:` header of each epic file (S/M/L), not this matrix (no Size column here); used by flow/batch model tiering."
    print "Phase 46+ epics: enriched template \342\200\224 epic files include Implementation Phases, Per-Phase Checkpoints, and Test Strategy sections (produced by `scripts/plan/brainstorm-emit.sh render-epic`). E1\342\200\223E186 epics use the legacy format; backward compat is additive-only."
    print "-->"
    print ""
    print "| Epic | Spec | Impl | QA | Commit | Merge | Notes |"
    print "|------|------|------|-----|--------|-------|-------|"
    while ((getline line < matrix_file) > 0) {
      print line
    }
    close(matrix_file)
    next
  }
  /<!-- EPIC_MATRIX_END -->/ {
    in_matrix=0
    print
    next
  }
  in_matrix { next }  # skip old content between sentinels

  { print }
' "$INDEX_FILE" > "$tmp_index" 2>/dev/null

if [[ -s "$tmp_index" ]]; then
  mv "$tmp_index" "$INDEX_FILE"
else
  rm -f "$tmp_index"
fi

rm -f "$phase_tmp" "$matrix_tmp"

printf 'render-index.sh: rendered %s from %s (prose-preserving merge)\n' "$INDEX_FILE" "$PROGRESS_FILE"
exit 0
