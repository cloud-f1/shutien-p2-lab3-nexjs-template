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
# Idempotent: running twice on the same epic-progress.md produces identical output.
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
# Step 1: Extract Phase Status table from epic-progress.md
# Collect rows between "## Phase Status" and the next "## " heading.
# Output format: | Phase N | E1, E2 | ✅ Complete |
# ---------------------------------------------------------------------------
phase_rows=$(awk '
  /^## Phase Status/ { in_section=1; next }
  in_section && /^\| Phase [0-9]/ { print; next }
  in_section && /^\| Infra/ { print; next }
  in_section && /^\|/ { next }
  in_section && /^## / { exit }
  in_section { next }
' "$PROGRESS_FILE" 2>/dev/null || true)

# Build the complete Phase Status table (header + rows)
phase_table="## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
${phase_rows}"

# ---------------------------------------------------------------------------
# Step 2: Extract Epic Step Matrix from epic-progress.md
# Collect rows between "## Epic Step Matrix" and the next "## " heading.
# Emit only epic data rows (lines starting with | E).
# ---------------------------------------------------------------------------
matrix_rows=$(awk '
  /^## Epic Step Matrix/ { in_section=1; next }
  in_section && /^\| E[0-9]/ { print; next }
  in_section && /^\|/ { next }
  in_section && /^## / { exit }
  in_section { next }
' "$PROGRESS_FILE" 2>/dev/null || true)

# Build the complete Epic Step Matrix table (header + rows from progress)
matrix_table="## Epic Step Matrix

<!--
Steps: spec → implement → qa → commit → merge
Status: ⬜ pending | 🔄 in-progress | ✅ done | ⏭️ skip | ❌ failed
Size: S (~1 session) | M (1-2 sessions) | L (2-3 sessions) — lives in each epic file's \`size:\` header (S/M/L), not this matrix (no Size column here); used by flow/batch model tiering.
Phase 46+ epics: enriched template — epic files include Implementation Phases, Per-Phase Checkpoints, and Test Strategy sections (produced by \`scripts/plan/brainstorm-emit.sh render-epic\`). E1–E186 epics use the legacy format; backward compat is additive-only.
-->

| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
${matrix_rows}"

# ---------------------------------------------------------------------------
# Step 3: Splice generated sections into INDEX_FILE between sentinel comments.
# If sentinels are absent, add them around the existing sections.
# ---------------------------------------------------------------------------

# Check if sentinels exist in the INDEX_FILE
has_phase_sentinel=0
has_matrix_sentinel=0
grep -q '<!-- PHASE_STATUS_START -->' "$INDEX_FILE" 2>/dev/null && has_phase_sentinel=1 || true
grep -q '<!-- EPIC_MATRIX_START -->' "$INDEX_FILE" 2>/dev/null && has_matrix_sentinel=1 || true

tmp_index="$INDEX_FILE.render.tmp"

# ---------------------------------------------------------------------------
# Step 3a: If sentinels are missing, inject them around the first occurrence
# of the Phase Status and Epic Step Matrix tables.
# ---------------------------------------------------------------------------
if [[ "$has_phase_sentinel" -eq 0 ]] || [[ "$has_matrix_sentinel" -eq 0 ]]; then
  # Add sentinels around the sections in a temporary copy
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
# Step 3b: Replace content between sentinels using awk.
# ---------------------------------------------------------------------------

# Write the new Phase Status block (without the trailing newline confusion)
# We use a temp file to pass the multi-line replacement through awk.
phase_tmp=$(mktemp 2>/dev/null || echo "/tmp/render_phase.$$")
matrix_tmp=$(mktemp 2>/dev/null || echo "/tmp/render_matrix.$$")

printf '%s\n' "$phase_rows" > "$phase_tmp"
printf '%s\n' "$matrix_rows" > "$matrix_tmp"

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

printf 'render-index.sh: rendered %s from %s\n' "$INDEX_FILE" "$PROGRESS_FILE"
exit 0
