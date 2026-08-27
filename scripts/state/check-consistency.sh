#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# check-consistency.sh — E361: internal self-consistency guard for the epic
# state file (docs/context/epic-progress.md).
#
# Relationship to scripts/state/check-drift.sh (E353) — READ THIS FIRST:
#
#   check-drift.sh asks "are the two files in sync" — it compares
#   epic-progress.md (SSOT) against its rendered derivative, EPIC_INDEX.md,
#   and fails when they disagree.
#
#   check-consistency.sh (this script) asks a different question: "is
#   epic-progress.md's OWN content internally correct". It never reads
#   EPIC_INDEX.md at all. The two files can be byte-identical and BOTH
#   wrong — that is exactly what happened in Phase 86 (PR #148): the Phase
#   Status row for Phase 86 still said "🟢 APPROVED" after all four of its
#   epics' Epic Step Matrix rows were fully ✅, render-index.sh faithfully
#   copied that wrong value into EPIC_INDEX.md, and check-drift.sh returned
#   exit 0 because the two files agreed — on the wrong answer.
#
#   Do not fold these two scripts together and do not remove either one:
#   check-drift.sh catches "someone edited the derived file instead of the
#   SSOT"; this script catches "the SSOT itself contradicts itself". Neither
#   subsumes the other.
#
# Rules (each maps to a real incident — see
# docs/epics/e361-state-branch-misplacement-guard.md):
#
#   R1 — sequence rule (accident 2, Phase 86 / E356). Steps run
#        spec -> implement -> qa -> commit -> merge, in that order. A step
#        can only be ✅ (done) if every step before it in the same Epic Step
#        Matrix row is "cleared" (✅ done, or ⏭️ deliberately skipped — e.g.
#        the documented retro-spec convention where spec=⏭️, implement=✅).
#        ✅ appearing after an uncleared earlier step (⬜ pending / 🔄
#        in-progress / ❌ failed) is a time-impossible combination — e.g.
#        commit=✅ while implement=⬜, the exact shape of accident 2.
#
#   R2 — phase/epic rollup rule (accident 3, Phase 86 close-out). If every
#        epic listed in a Phase Status row has all 5 of its Epic Step Matrix
#        columns cleared (✅ or ⏭️), that Phase Status row's Status cell must
#        itself start with ✅ (Complete). A phase row whose epic list can't
#        be fully resolved against the Epic Step Matrix (e.g. the
#        "Phases 53–68 | E217–E293" summarized range, which is not
#        individually itemized in the matrix) is SKIPPED, never flagged —
#        unresolvable data must never become a false positive.
#
#   W1 — uncommitted-state advisory (accident 1, `reset --hard`). If the
#        real epic-progress.md (not a test fixture — see env overrides
#        below) has uncommitted working-tree changes, print an advisory.
#        This is NOT the drift-gate rule and does not affect the exit code:
#        the loop protocol's `git reset --hard origin/main` sync step is
#        explicitly out of scope for this epic (see "Out of Scope" in the
#        spec) — the fix here is visibility, not auto-committing state
#        changes as a side effect of an unrelated quality gate.
#
# Deliberately NOT implemented — the spec's 3rd candidate rule, "merge=✅ but
# no matching merge commit found in git history": every heuristic tried
# during the spec write-up against this repo's real git history produced
# false positives (squash-merged waves, batch "chore(state): Phase N 完成"
# commits covering several epics, retro-registered epics whose merge predates
# epic-progress.md itself). The epic explicitly says: "若某條規則在真實資料
# 上會誤報，就不要加那條規則" — so it's left out rather than shipped noisy.
#
# Environment overrides (for testing — MUST use these; never touch the real
# state files from a test):
#   PROGRESS_FILE — path to epic-progress.md (default: docs/context/epic-progress.md)
#   AUDIT_LOG     — path to audit log        (default: .claude/audit.jsonl)
#
# Usage:
#   scripts/state/check-consistency.sh      # exits 1 if R1/R2 violations found, 0 if clean
# -----------------------------------------------------------------------------
set -uo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$repo_root" ]]; then
  cd "$repo_root" || true
fi

DEFAULT_PROGRESS_FILE="docs/context/epic-progress.md"
PROGRESS_FILE="${PROGRESS_FILE:-$DEFAULT_PROGRESS_FILE}"
AUDIT_LOG="${AUDIT_LOG:-.claude/audit.jsonl}"
IS_DEFAULT_FILE=0
[[ "$PROGRESS_FILE" == "$DEFAULT_PROGRESS_FILE" ]] && IS_DEFAULT_FILE=1

if [[ ! -f "$PROGRESS_FILE" ]]; then
  printf 'check-consistency.sh: PROGRESS_FILE not found: %s\n' "$PROGRESS_FILE" >&2
  exit 0
fi

iso_ts=$(date -u +%FT%TZ 2>/dev/null || date -u '+%Y-%m-%dT%H:%M:%SZ')
violations=0
details=()

# ---------------------------------------------------------------------------
# R1 — sequence rule. Extract Epic Step Matrix rows as TSV
# (epic, spec, impl, qa, commit, merge). Notes (column 7+) may contain
# embedded "|" which inflates NF, but columns 2-7 are always the 5 status
# cells plus the epic id, same guarantee check-drift.sh relies on.
# ---------------------------------------------------------------------------
matrix_tsv=$(awk -F'|' '
  /^## Epic Step Matrix/ { in_section=1; next }
  in_section && /^\| E[0-9]/ {
    for (i = 2; i <= 7; i++) { gsub(/^[ \t]+|[ \t]+$/, "", $i) }
    print $2"\t"$3"\t"$4"\t"$5"\t"$6"\t"$7
    next
  }
  in_section && /^\|/ { next }
  in_section && /^## / { exit }
' "$PROGRESS_FILE" 2>/dev/null || true)

step_names=(Spec Impl QA Commit Merge)

if [[ -n "$matrix_tsv" ]]; then
  while IFS=$'\t' read -r epic spec impl qa commit merge; do
    [[ -z "$epic" ]] && continue
    steps=("$spec" "$impl" "$qa" "$commit" "$merge")
    seen_uncleared=0
    blocker_name=""
    blocker_val=""
    for idx in 0 1 2 3 4; do
      val="${steps[$idx]}"
      if [[ "$val" == "✅" || "$val" == "⏭️" ]]; then
        if [[ "$seen_uncleared" -eq 1 && "$val" == "✅" ]]; then
          violations=$((violations + 1))
          details+=("${epic}: ${step_names[$idx]}=✅ but ${blocker_name}=${blocker_val} (impossible sequence)")
          break
        fi
      else
        if [[ "$seen_uncleared" -eq 0 ]]; then
          seen_uncleared=1
          blocker_name="${step_names[$idx]}"
          blocker_val="$val"
        fi
      fi
    done
  done <<< "$matrix_tsv"
fi

# ---------------------------------------------------------------------------
# R2 — phase/epic rollup rule.
# ---------------------------------------------------------------------------
epic_cleared_lookup() {
  # Prints "yes" | "no" | "unknown" for the given epic id against matrix_tsv.
  local epic="$1"
  local row
  row=$(printf '%s\n' "$matrix_tsv" | awk -F'\t' -v e="$epic" '$1 == e { print; exit }')
  if [[ -z "$row" ]]; then
    printf 'unknown\n'
    return
  fi
  IFS=$'\t' read -r _ s i q c m <<< "$row"
  for v in "$s" "$i" "$q" "$c" "$m"; do
    if [[ "$v" != "✅" && "$v" != "⏭️" ]]; then
      printf 'no\n'
      return
    fi
  done
  printf 'yes\n'
}

phase_tsv=$(awk -F'|' '
  /^## Phase Status/ { in_section=1; next }
  in_section && /^\| (Phase|Infra)/ {
    gsub(/^[ \t]+|[ \t]+$/, "", $2)
    gsub(/^[ \t]+|[ \t]+$/, "", $3)
    gsub(/^[ \t]+|[ \t]+$/, "", $4)
    print $2"\t"$3"\t"$4
    next
  }
  in_section && /^\|/ { next }
  in_section && /^## / { exit }
' "$PROGRESS_FILE" 2>/dev/null || true)

if [[ -n "$phase_tsv" ]]; then
  while IFS=$'\t' read -r phase_name epics_field status_field; do
    [[ -z "$phase_name" ]] && continue

    # Expand epics_field into a list of "E<n>" tokens. Two shapes seen in the
    # real data: a comma list ("E353, E354, E355") and an en-dash range
    # ("E217–E293", used only for one summarized multi-phase row).
    epic_list=()
    if [[ "$epics_field" =~ ^E([0-9]+)[-–]E([0-9]+)$ ]]; then
      lo="${BASH_REMATCH[1]}"
      hi="${BASH_REMATCH[2]}"
      for ((n = lo; n <= hi; n++)); do
        epic_list+=("E${n}")
      done
    else
      IFS=',' read -ra raw_parts <<< "$epics_field"
      for part in "${raw_parts[@]+"${raw_parts[@]}"}"; do
        trimmed=$(printf '%s' "$part" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
        [[ "$trimmed" =~ ^E[0-9]+$ ]] && epic_list+=("$trimmed")
      done
    fi

    [[ ${#epic_list[@]} -eq 0 ]] && continue

    all_cleared=1
    unresolvable=0
    for e in "${epic_list[@]}"; do
      result=$(epic_cleared_lookup "$e")
      if [[ "$result" == "unknown" ]]; then
        unresolvable=1
        break
      elif [[ "$result" == "no" ]]; then
        all_cleared=0
        break
      fi
    done

    # Unresolvable (epic not itemized in the matrix) -> skip this phase row
    # entirely rather than risk a false positive.
    [[ "$unresolvable" -eq 1 ]] && continue
    # Not every epic is fully cleared yet -> in-progress phase, not a violation.
    [[ "$all_cleared" -eq 0 ]] && continue

    if [[ "$status_field" != ✅* ]]; then
      status_preview="$status_field"
      if [[ ${#status_preview} -gt 60 ]]; then
        status_preview="${status_preview:0:57}..."
      fi
      violations=$((violations + 1))
      details+=("${phase_name}: all listed epics (${epics_field}) are fully done/skip, but Status=\"${status_preview}\" does not start with ✅ Complete")
    fi
  done <<< "$phase_tsv"
fi

# ---------------------------------------------------------------------------
# Report R1/R2 findings.
# ---------------------------------------------------------------------------
full_detail=""
for d in "${details[@]+"${details[@]}"}"; do
  if [[ -z "$full_detail" ]]; then
    full_detail="$d"
  else
    full_detail="${full_detail}; ${d}"
  fi
done

if [[ "$violations" -gt 0 ]]; then
  first_detail="$full_detail"
  if [[ ${#first_detail} -gt 300 ]]; then
    first_detail="${first_detail:0:297}..."
  fi

  if command -v jq >/dev/null 2>&1; then
    mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true
    jq -n -c \
      --arg ts "$iso_ts" \
      --arg event "state_inconsistency" \
      --arg source "check-consistency.sh" \
      --argjson violations "$violations" \
      --arg first "$first_detail" \
      '{ts:$ts,event:$event,source:$source,violations:$violations,first:$first}' \
      >> "$AUDIT_LOG" 2>/dev/null || true
  fi

  printf 'check-consistency.sh: %d inconsistency(ies) found in %s\n' "$violations" "$PROGRESS_FILE" >&2
  printf 'Detail: %s\n' "$full_detail" >&2
  printf 'Fix the SSOT row(s) directly (docs/context/epic-progress.md), then re-render EPIC_INDEX.md via scripts/state/render-index.sh.\n' >&2
else
  printf 'check-consistency.sh: clean — %s is internally consistent (R1 sequence + R2 phase rollup)\n' "$PROGRESS_FILE"
fi

# ---------------------------------------------------------------------------
# W1 — uncommitted-state advisory (accident 1). Advisory only: never affects
# the exit code, and only runs against the REAL default file — a test that
# injects PROGRESS_FILE never touches git status for it.
# ---------------------------------------------------------------------------
if [[ "$IS_DEFAULT_FILE" -eq 1 ]] && [[ -n "$repo_root" ]] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --quiet -- "$PROGRESS_FILE" 2>/dev/null || ! git diff --cached --quiet -- "$PROGRESS_FILE" 2>/dev/null; then
    printf 'check-consistency.sh: WARN — %s has uncommitted changes. Commit them before running `git reset --hard` / `git checkout` / switching branches, or they will be silently discarded (this is exactly how accident 1 happened in Phase 86).\n' "$PROGRESS_FILE" >&2
  fi
fi

[[ "$violations" -gt 0 ]] && exit 1
exit 0
