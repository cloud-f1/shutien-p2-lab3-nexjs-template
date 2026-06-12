#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# check-drift.sh — E196 drift detector: compares EPIC_INDEX.md vs epic-progress.md
#
# Re-renders epic-progress.md to a temp file, then diffs per-cell status values
# against EPIC_INDEX.md. On mismatch, emits a state_drift event to audit.jsonl
# and exits non-zero. Exits 0 when the files are in sync.
#
# Environment overrides (for testing):
#   PROGRESS_FILE  — path to epic-progress.md (default: docs/context/epic-progress.md)
#   INDEX_FILE     — path to EPIC_INDEX.md    (default: docs/epics/EPIC_INDEX.md)
#   AUDIT_LOG      — path to audit log        (default: .claude/audit.jsonl)
#
# Usage:
#   scripts/state/check-drift.sh            # exits 1 if drift found, 0 if clean
#
# Emits per-epic state_drift event:
#   {"ts":"...","event":"state_drift","source":"check-drift.sh","mismatches":N,
#    "epic":"E156","expected":"✅","found":"🔄"}
# -----------------------------------------------------------------------------
set -uo pipefail

# Resolve repo root
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$repo_root" ]]; then
  cd "$repo_root" || true
fi

PROGRESS_FILE="${PROGRESS_FILE:-docs/context/epic-progress.md}"
INDEX_FILE="${INDEX_FILE:-docs/epics/EPIC_INDEX.md}"
AUDIT_LOG="${AUDIT_LOG:-.claude/audit.jsonl}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER="$SCRIPT_DIR/render-index.sh"

if [[ ! -f "$PROGRESS_FILE" ]]; then
  printf 'check-drift.sh: PROGRESS_FILE not found: %s\n' "$PROGRESS_FILE" >&2
  exit 0
fi

if [[ ! -f "$INDEX_FILE" ]]; then
  printf 'check-drift.sh: INDEX_FILE not found: %s\n' "$INDEX_FILE" >&2
  exit 0
fi

if [[ ! -x "$RENDER" ]]; then
  printf 'check-drift.sh: render-index.sh not executable at %s\n' "$RENDER" >&2
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 1: Extract Phase Status rows from epic-progress.md
# ---------------------------------------------------------------------------
extract_phase_status() {
  local file="$1"
  awk '
    /^## Phase Status/ { in_section=1; next }
    in_section && /^\| Phase [0-9]/ { print; next }
    in_section && /^\| Infra/ { print; next }
    in_section && /^\|/ { next }
    in_section && /^## / { exit }
    in_section { next }
  ' "$file" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Step 2: Extract Epic Step Matrix rows from epic-progress.md
# ---------------------------------------------------------------------------
extract_matrix_rows() {
  local file="$1"
  awk '
    /^## Epic Step Matrix/ { in_section=1; next }
    in_section && /^\| E[0-9]/ { print; next }
    in_section && /^\|/ { next }
    in_section && /^## / { exit }
    in_section { next }
  ' "$file" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Step 3: Extract Phase Status rows from EPIC_INDEX.md (between sentinels)
# ---------------------------------------------------------------------------
extract_index_phase_status() {
  local file="$1"
  awk '
    /<!-- PHASE_STATUS_START -->/ { in_section=1; next }
    /<!-- PHASE_STATUS_END -->/ { in_section=0; next }
    in_section && /^\| Phase [0-9]/ { print; next }
    in_section && /^\| Infra/ { print; next }
    in_section && /^\|/ { next }
  ' "$file" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Step 4: Extract Epic Step Matrix rows from EPIC_INDEX.md (between sentinels)
# ---------------------------------------------------------------------------
extract_index_matrix_rows() {
  local file="$1"
  awk '
    /<!-- EPIC_MATRIX_START -->/ { in_section=1; next }
    /<!-- EPIC_MATRIX_END -->/ { in_section=0; next }
    in_section && /^\| E[0-9]/ { print; next }
    in_section && /^\|/ { next }
  ' "$file" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Step 5: Compare Phase Status rows and collect mismatches
# ---------------------------------------------------------------------------
iso_ts=$(date -u +%FT%TZ 2>/dev/null || date -u '+%Y-%m-%dT%H:%M:%SZ')
mismatches=0

# Get expected rows from epic-progress.md
expected_phase=$(extract_phase_status "$PROGRESS_FILE")
# Get actual rows from EPIC_INDEX.md
actual_phase=$(extract_index_phase_status "$INDEX_FILE")

# If EPIC_INDEX doesn't have sentinels, the phase section will be empty — that's drift
if [[ -z "$actual_phase" ]] && [[ -n "$expected_phase" ]]; then
  mismatches=$((mismatches + 1))
  mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true
  printf '{"ts":"%s","event":"state_drift","source":"check-drift.sh","mismatches":%d,"section":"phase_status","expected":"(rows present)","found":"(sentinels missing or section empty)"}\n' \
    "$iso_ts" 1 >> "$AUDIT_LOG" 2>/dev/null || true
else
  # Compare row by row, extracting just the Status cell (3rd column)
  while IFS= read -r expected_row; do
    # Extract phase name (column 1) and status (column 3)
    phase_name=$(printf '%s' "$expected_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}')
    expected_status=$(printf '%s' "$expected_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4); print $4}')

    # Find matching row in actual EPIC_INDEX.md
    actual_row=$(printf '%s' "$actual_phase" | grep "| ${phase_name} |" | head -1)
    if [[ -z "$actual_row" ]]; then
      # Phase row missing from index — that's drift
      mismatches=$((mismatches + 1))
      mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true
      printf '{"ts":"%s","event":"state_drift","source":"check-drift.sh","mismatches":%d,"epic":"%s","expected":"%s","found":"(missing)"}\n' \
        "$iso_ts" 1 "$phase_name" "$expected_status" >> "$AUDIT_LOG" 2>/dev/null || true
    else
      actual_status=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4); print $4}')
      # Compare just the first emoji/status symbol (not the full note text)
      exp_symbol=$(printf '%s' "$expected_status" | grep -oE '^[✅🔄⬜❌⏭️]+' | head -1 || printf '%s' "$expected_status" | cut -c1-4)
      act_symbol=$(printf '%s' "$actual_status" | grep -oE '^[✅🔄⬜❌⏭️]+' | head -1 || printf '%s' "$actual_status" | cut -c1-4)
      if [[ "$exp_symbol" != "$act_symbol" ]]; then
        mismatches=$((mismatches + 1))
        mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true
        printf '{"ts":"%s","event":"state_drift","source":"check-drift.sh","mismatches":%d,"epic":"%s","expected":"%s","found":"%s"}\n' \
          "$iso_ts" 1 "$phase_name" "$expected_status" "$actual_status" >> "$AUDIT_LOG" 2>/dev/null || true
      fi
    fi
  done <<< "$expected_phase"
fi

# ---------------------------------------------------------------------------
# Step 6: Compare Epic Step Matrix rows and collect per-epic cell mismatches
# ---------------------------------------------------------------------------
expected_matrix=$(extract_matrix_rows "$PROGRESS_FILE")
actual_matrix=$(extract_index_matrix_rows "$INDEX_FILE")

if [[ -z "$actual_matrix" ]] && [[ -n "$expected_matrix" ]]; then
  mismatches=$((mismatches + 1))
  mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true
  printf '{"ts":"%s","event":"state_drift","source":"check-drift.sh","mismatches":%d,"section":"epic_matrix","expected":"(rows present)","found":"(sentinels missing or section empty)"}\n' \
    "$iso_ts" 1 >> "$AUDIT_LOG" 2>/dev/null || true
else
  # Detect EPIC_INDEX matrix format from the header row (not data rows, which may
  # have | inside Notes and inflate NF). Look for "Name" column as indicator.
  index_matrix_header=$(awk '
    /<!-- EPIC_MATRIX_START -->/ { in_section=1; next }
    /<!-- EPIC_MATRIX_END -->/ { in_section=0; next }
    in_section && /^\| Epic/ { print; exit }
  ' "$INDEX_FILE" 2>/dev/null || true)

  # Extended format has Name+Size columns: | Epic | Name | Size | Spec | Impl | QA | Commit | Merge | Notes |
  index_matrix_extended=0
  if printf '%s' "$index_matrix_header" | grep -q '| Name |'; then
    index_matrix_extended=1
  fi

  while IFS= read -r expected_row; do
    # Extract epic ID (column 2 in awk, field between 1st and 2nd pipe)
    epic_id=$(printf '%s' "$expected_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}')
    [[ -z "$epic_id" ]] && continue

    # Find matching row in actual EPIC_INDEX.md
    actual_row=$(printf '%s' "$actual_matrix" | grep "^| ${epic_id} |" | head -1)
    if [[ -z "$actual_row" ]]; then
      # Epic row missing from index — skip silently (EPIC_INDEX may be abbreviated)
      continue
    fi

    # Extract step columns from epic-progress.md row (always standard format):
    # | Epic | Spec | Impl | QA | Commit | Merge | Notes |
    # $2=Epic, $3=Spec, $4=Impl, $5=QA, $6=Commit, $7=Merge
    # Note: Notes may contain \| which inflates NF, but cols 2-7 are always correct.
    exp_spec=$(printf '%s' "$expected_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $3); print $3}')
    exp_impl=$(printf '%s' "$expected_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4); print $4}')
    exp_qa=$(printf '%s' "$expected_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $5); print $5}')
    exp_commit=$(printf '%s' "$expected_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $6); print $6}')
    exp_merge=$(printf '%s' "$expected_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $7); print $7}')

    # Extract step columns from EPIC_INDEX.md row.
    # Standard format: | Epic | Spec | Impl | QA | Commit | Merge | Notes |
    # Extended format: | Epic | Name | Size | Spec | Impl | QA | Commit | Merge | Notes |
    if [[ "$index_matrix_extended" -eq 1 ]]; then
      act_spec=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $5); print $5}')
      act_impl=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $6); print $6}')
      act_qa=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $7); print $7}')
      act_commit=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $8); print $8}')
      act_merge=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $9); print $9}')
    else
      act_spec=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $3); print $3}')
      act_impl=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4); print $4}')
      act_qa=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $5); print $5}')
      act_commit=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $6); print $6}')
      act_merge=$(printf '%s' "$actual_row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $7); print $7}')
    fi

    # Check each step column (only the 5 status cells — skip Notes which may drift)
    for col_entry in "Spec:$exp_spec:$act_spec" "Impl:$exp_impl:$act_impl" "QA:$exp_qa:$act_qa" "Commit:$exp_commit:$act_commit" "Merge:$exp_merge:$act_merge"; do
      col_name="${col_entry%%:*}"
      rest="${col_entry#*:}"
      exp_val="${rest%%:*}"
      act_val="${rest#*:}"

      if [[ "$exp_val" != "$act_val" ]]; then
        mismatches=$((mismatches + 1))
        mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true
        printf '{"ts":"%s","event":"state_drift","source":"check-drift.sh","mismatches":%d,"epic":"%s","column":"%s","expected":"%s","found":"%s"}\n' \
          "$iso_ts" 1 "$epic_id" "$col_name" "$exp_val" "$act_val" >> "$AUDIT_LOG" 2>/dev/null || true
      fi
    done
  done < <(printf '%s\n' "$expected_matrix")
fi

# ---------------------------------------------------------------------------
# Exit
# ---------------------------------------------------------------------------
if [[ "$mismatches" -gt 0 ]]; then
  printf 'check-drift.sh: %d mismatch(es) found between %s and %s\n' \
    "$mismatches" "$PROGRESS_FILE" "$INDEX_FILE" >&2
  printf 'Run: scripts/state/render-index.sh to reconcile.\n' >&2
  exit 1
fi

printf 'check-drift.sh: clean — %s matches %s\n' "$INDEX_FILE" "$PROGRESS_FILE"
exit 0
