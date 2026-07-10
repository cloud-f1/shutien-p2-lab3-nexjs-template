#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# state-update.sh — single CLI to flip one step cell for one epic in the Epic
# Step Matrix, replacing the "hand-edit both epic-progress.md AND EPIC_INDEX.md"
# pattern that caused recorded dual-write drift.
#
# Usage:
#   scripts/state/state-update.sh <EpicID> <step> <status> [--note "text"]
#
# Examples:
#   scripts/state/state-update.sh E320 qa done
#   scripts/state/state-update.sh e320 merge awaiting-merge --note "PR #85"
#   scripts/state/state-update.sh E75 implement failed --note "Phase 20 — build broke"
#
# Args:
#   EpicID   Case-insensitive epic id (e12 -> E12)
#   step     spec | implement | qa | commit | merge
#   status   pending | in-progress | done | skip | failed | awaiting-merge
#   --note   optional. For `merge awaiting-merge`, the value is embedded in the
#            merge cell itself: "⏸ awaiting human merge (<note>)" — this matches
#            the existing convention described in loop.md's publish protocol
#            (the merge cell carries the PR reference directly, not a separate
#            Notes-column pointer). For every other step/status combination,
#            --note updates the Notes column, preserving an existing
#            "Phase N — " prefix if present.
#
# Behavior:
#   - Edits the row in docs/context/epic-progress.md (Epic Step Matrix; source
#     of truth — see loop.md "State vs Catalog Separation").
#   - Then, if EPIC_INDEX.md has a matching matrix row, mirrors the SAME
#     surgical row edit there. It deliberately does NOT call render-index.sh:
#     a full re-render rebuilds the Phase Status table from epic-progress.md's
#     lean rows and would wipe EPIC_INDEX.md's rich per-phase prose (known
#     E196 gap — see the inline note at the sync block below).
#   - Idempotent: setting a cell to its current value is a no-op success (exit 0,
#     no file write).
#   - Exits 1 with a clear message if the epic row is not found — this script
#     never creates rows (that's the epic-registration procedure's job).
#   - Emits one audit event on success (including no-op success):
#       bash scripts/hooks/audit-emit-pipeline.sh state_update epic=E{n} step={step} status={status}
#
# Env overrides (test injection, mirrors the AUDIT_LOG_PATH pattern used across
# scripts/hooks):
#   STATE_PROGRESS_PATH   override docs/context/epic-progress.md
#   STATE_INDEX_PATH      override docs/epics/EPIC_INDEX.md
#   AUDIT_LOG_PATH         override .claude/audit.jsonl (passed through to the
#                          audit emitter — not read directly by this script)
#
# Exit codes:
#   0  success (row updated, or idempotent no-op)
#   1  usage error / unknown epic / invalid step / invalid status
# -----------------------------------------------------------------------------

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<'EOF'
usage: state-update.sh <EpicID> <step> <status> [--note "text"]

  step:   spec | implement | qa | commit | merge
  status: pending | in-progress | done | skip | failed | awaiting-merge

Examples:
  state-update.sh E320 qa done
  state-update.sh E320 merge awaiting-merge --note "PR #85"
EOF
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

EPIC_RAW="${1:-}"
STEP_RAW="${2:-}"
STATUS_RAW="${3:-}"

if [ -z "$EPIC_RAW" ] || [ -z "$STEP_RAW" ] || [ -z "$STATUS_RAW" ]; then
  usage
  exit 1
fi

shift 3 2>/dev/null || true

NOTE=""
HAS_NOTE=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --note)
      HAS_NOTE=1
      NOTE="${2:-}"
      shift 2 2>/dev/null || shift $#
      ;;
    *)
      echo "state-update.sh: unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# Normalize epic id: case-insensitive, must be E<digits>
EPIC="$(printf '%s' "$EPIC_RAW" | tr 'a-z' 'A-Z')"
if ! printf '%s' "$EPIC" | grep -qE '^E[0-9]+$'; then
  echo "state-update.sh: invalid epic id: $EPIC_RAW (expected E<number>, e.g. E320)" >&2
  exit 1
fi

STEP="$(printf '%s' "$STEP_RAW" | tr 'A-Z' 'a-z')"
STATUS="$(printf '%s' "$STATUS_RAW" | tr 'A-Z' 'a-z')"

# step -> array index (0-based, matches the CUR[] extraction order below) and
# -> pipe-table column number (fields: 1="" 2=Epic 3=Spec 4=Impl 5=QA 6=Commit
#    7=Merge 8=Notes 9="")
case "$STEP" in
  spec)       STEP_IDX=0; COL=3 ;;
  implement)  STEP_IDX=1; COL=4 ;;
  qa)         STEP_IDX=2; COL=5 ;;
  commit)     STEP_IDX=3; COL=6 ;;
  merge)      STEP_IDX=4; COL=7 ;;
  *)
    echo "state-update.sh: unknown step: $STEP_RAW (expected spec|implement|qa|commit|merge)" >&2
    exit 1
    ;;
esac

# status -> symbol
case "$STATUS" in
  pending)        SYMBOL="⬜" ;;
  in-progress)    SYMBOL="🔄" ;;
  done)           SYMBOL="✅" ;;
  skip)           SYMBOL="⏭️" ;;
  failed)         SYMBOL="❌" ;;
  awaiting-merge) SYMBOL="⏸" ;;
  *)
    echo "state-update.sh: unknown status: $STATUS_RAW (expected pending|in-progress|done|skip|failed|awaiting-merge)" >&2
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Resolve paths (mirror render-index.sh's own repo-root resolution)
# ---------------------------------------------------------------------------

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$repo_root" ]; then
  cd "$repo_root" || true
fi

PROGRESS_FILE="${STATE_PROGRESS_PATH:-docs/context/epic-progress.md}"
INDEX_FILE="${STATE_INDEX_PATH:-docs/epics/EPIC_INDEX.md}"

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "state-update.sh: PROGRESS_FILE not found: $PROGRESS_FILE" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Locate the epic row and extract current cell values
# ---------------------------------------------------------------------------

extract="$(awk -v target="$EPIC" '
  BEGIN { FS="|" }
  {
    e = $2
    gsub(/^[ \t]+|[ \t]+$/, "", e)
    if (e == target) {
      for (i = 3; i <= 8; i++) {
        v = $i
        gsub(/^[ \t]+|[ \t]+$/, "", v)
        print v
      }
      print "FOUND_OK"
      exit
    }
  }
' "$PROGRESS_FILE")"

if [ -z "$extract" ] || [ "$(printf '%s\n' "$extract" | tail -1)" != "FOUND_OK" ]; then
  echo "state-update.sh: epic $EPIC not found in Epic Step Matrix ($PROGRESS_FILE) — this script does not create rows" >&2
  exit 1
fi

CUR=()
idx=0
while IFS= read -r line; do
  CUR[idx]="$line"
  idx=$((idx + 1))
done <<EOF
$extract
EOF
# CUR[0]=spec CUR[1]=impl CUR[2]=qa CUR[3]=commit CUR[4]=merge CUR[5]=notes CUR[6]=FOUND_OK

CURRENT_CELL="${CUR[$STEP_IDX]}"
CURRENT_NOTES="${CUR[5]}"

# ---------------------------------------------------------------------------
# Compute the new cell value + (maybe) new notes value
# ---------------------------------------------------------------------------

DO_NOTES=0
NEW_NOTES="$CURRENT_NOTES"

if [ "$STEP" = "merge" ] && [ "$STATUS" = "awaiting-merge" ]; then
  # Special case: the full human-readable text lives IN the merge cell itself
  # (matches loop.md's publish protocol convention), not the Notes column.
  if [ "$HAS_NOTE" -eq 1 ] && [ -n "$NOTE" ]; then
    NEW_CELL="⏸ awaiting human merge (${NOTE})"
  else
    NEW_CELL="⏸ awaiting human merge"
  fi
else
  NEW_CELL="$SYMBOL"
  if [ "$HAS_NOTE" -eq 1 ]; then
    DO_NOTES=1
    # Preserve an existing "Phase N — " (or "Phase N - ") prefix, replace the rest.
    prefix="$(printf '%s' "$CURRENT_NOTES" | grep -oE '^Phase [0-9]+ (—|-) ' | head -1)"
    if [ -n "$prefix" ]; then
      NEW_NOTES="${prefix}${NOTE}"
    else
      NEW_NOTES="$NOTE"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Idempotency check
# ---------------------------------------------------------------------------

CHANGED=0
[ "$NEW_CELL" != "$CURRENT_CELL" ] && CHANGED=1
if [ "$DO_NOTES" -eq 1 ] && [ "$NEW_NOTES" != "$CURRENT_NOTES" ]; then
  CHANGED=1
fi

if [ "$CHANGED" -eq 0 ]; then
  echo "state-update.sh: $EPIC $STEP already $STATUS_RAW — no-op"
  bash scripts/hooks/audit-emit-pipeline.sh state_update epic="$EPIC" step="$STEP" status="$STATUS" || true
  exit 0
fi

# ---------------------------------------------------------------------------
# Write the updated row back to PROGRESS_FILE
# ---------------------------------------------------------------------------

tmpfile="$(mktemp 2>/dev/null || echo "/tmp/state-update.$$")"

awk -v target="$EPIC" -v col="$COL" -v newval="$NEW_CELL" -v do_notes="$DO_NOTES" -v newnotes="$NEW_NOTES" '
  BEGIN { FS="|"; OFS="|" }
  {
    e = $2
    gsub(/^[ \t]+|[ \t]+$/, "", e)
    if (e == target) {
      $col = " " newval " "
      if (do_notes == "1") {
        $8 = " " newnotes " "
      }
    }
    print
  }
' "$PROGRESS_FILE" > "$tmpfile" && mv "$tmpfile" "$PROGRESS_FILE"

# ---------------------------------------------------------------------------
# Sync EPIC_INDEX.md — surgical edit of the SAME matrix row only.
#
# Deliberately NOT render-index.sh: a full re-render rebuilds the Phase Status
# table from epic-progress.md's lean rows and would WIPE the rich historical
# prose EPIC_INDEX.md carries per phase (78 rich rows vs 63 lean — verified
# 2026-07-10). Until that gap is closed, this script mirrors the single
# matrix-row change and touches nothing else.
# ---------------------------------------------------------------------------

if [ -f "$INDEX_FILE" ] && grep -qE "^\|[ \t]*${EPIC}[ \t]*\|" "$INDEX_FILE"; then
  tmpfile2="$(mktemp 2>/dev/null || echo "/tmp/state-update-idx.$$")"
  awk -v target="$EPIC" -v col="$COL" -v newval="$NEW_CELL" -v do_notes="$DO_NOTES" -v newnotes="$NEW_NOTES" '
    BEGIN { FS="|"; OFS="|" }
    {
      e = $2
      gsub(/^[ \t]+|[ \t]+$/, "", e)
      if (e == target) {
        $col = " " newval " "
        if (do_notes == "1") {
          $8 = " " newnotes " "
        }
      }
      print
    }
  ' "$INDEX_FILE" > "$tmpfile2" && mv "$tmpfile2" "$INDEX_FILE"
fi

echo "state-update.sh: $EPIC $STEP -> $STATUS_RAW"

bash scripts/hooks/audit-emit-pipeline.sh state_update epic="$EPIC" step="$STEP" status="$STATUS" || true

exit 0
