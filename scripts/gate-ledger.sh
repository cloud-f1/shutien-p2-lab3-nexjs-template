#!/usr/bin/env bash
# gate-ledger.sh — E345 gate ledger: aggregate `gate_result` events from
# .claude/audit.jsonl into a per-phase, per-gate pass/fail/skipped summary,
# and (in report mode) render docs/context/gate-ledger.md.
#
# WHY THIS EXISTS: skipping a gate (e2e needs a DB nobody can spare right now,
# etc.) is a legitimate engineering decision. The Phase 82 incident this epic
# answers was never "gates got skipped" — it was that the skip left no
# structured trace: state files, gate results, and the phase-complete record
# all said PASS while an e2e-only defect sat on `main`. This script is the
# view onto the structured trace (scripts/hooks/audit-emit-gate.sh is the
# writer); the phase-completion guard (Rule 24 in
# scripts/hooks/stop-verifier.sh) is what gives that view teeth.
#
# Usage:
#   scripts/gate-ledger.sh                             # full report, every phase seen in the log
#   scripts/gate-ledger.sh --phase 82                  # scoped to phase 82
#   scripts/gate-ledger.sh --phase 82 --check-only     # exit 2 if phase 82 has an unreconciled
#                                                       # skipped gate, exit 0 otherwise. No
#                                                       # stdout report, no docs/ write — used by
#                                                       # the stop-verifier phase-complete guard
#                                                       # (Rule 24). Requires --phase.
#   scripts/gate-ledger.sh --phase 82 --accept-skips "e2e: DB isolation fix tracked in #117"
#                                                       # records the acceptance, then reports.
#
# ┌────────────────────────────────────────────────────────────────────────┐
# │ --accept-skips is a HUMAN act. Mirrors the hard rule in                  │
# │ .claude/commands/athena/approve.md: NEVER invoke it from cron,          │
# │ /athena:loop, /athena:batch auto, or an agent's own initiative. If you   │
# │ (an agent) arrived here without an explicit user instruction naming     │
# │ this exact phase and reason, STOP and ask instead of running this flag. │
# └────────────────────────────────────────────────────────────────────────┘
#
# "Unreconciled" — DELIBERATE SEMANTICS, chosen after a real bug (read this
# before touching the comparison below):
#
# A phase has an unreconciled skip when it has AT LEAST ONE recorded
# gate_result{status:skipped} for that phase AND NO acceptance has EVER been
# recorded for that phase:
#
#     unreconciled = (some skip exists for the phase) AND (no acceptance exists for the phase)
#
# This is a binary, existence-only check — it does NOT compare the skip's
# timestamp against the acceptance's timestamp. An earlier version of this
# script did compare timestamps ("accept must be newer than the last skip to
# count"), which had two problems:
#   1. Both timestamps are second-resolution (`%Y-%m-%dT%H:%M:%SZ`), so two
#      independently-generated events landing in the same wall-clock second
#      (a real, observed scenario: a fresh-clone test recording a skip right
#      after cloning a just-committed acceptance) race — same data, different
#      answer depending on which side of a second boundary either event fell.
#   2. More fundamentally, timestamp comparison encodes "an acceptance only
#      covers skips that already existed when it was granted" — meaning the
#      *same logical skip*, re-observed later (a re-run of the same gate,
#      a different worktree, another machine), silently un-reconciles a
#      human's already-granted acceptance. A phase could flip back to
#      blocked with no one having done anything wrong.
#
# DECISION: acceptance is phase-scoped and DURABLE — once a human accepts a
# phase's skips, that phase stays reconciled regardless of when the skip(s)
# it covers were (or later are) recorded, until this epic grows an explicit
# revoke mechanism (none exists yet — out of scope for E345). This mirrors
# `/athena:approve`: a phase's 🟢 APPROVED status isn't invalidated by
# re-reading the epic file, and an epic's approval doesn't expire just
# because someone looks at it again later. Predictability over precision:
# a coarse, race-free "has anyone with authority signed off on this phase's
# skips at all" beats a precise-looking comparison that depends on clock
# resolution. The alternative (identity-scoped: track WHICH (gate, epic)
# pairs were accepted, so a genuinely new skip on a DIFFERENT gate/epic still
# requires fresh acknowledgement) is more precise but adds real complexity
# for a case this epic has no evidence is a live problem; revisit if it ever
# is. A phase with ZERO gate_result events recorded is NOT unreconciled —
# there is nothing here to reconcile; this script cannot see work that
# predates audit-emit-gate.sh's own existence (see docs/epics/e345-gate-ledger.md
# — Phase 82 itself is exactly this case: the emitter did not exist yet, so
# `--phase 82` finds no gate_result data at all, not "8 e2e skips").
#
# One more consequence worth stating explicitly: a LATER gate_result=pass for
# the same gate does NOT, by itself, clear an earlier skip's record — skip
# events are permanent history (the audit log is append-only), and pass/skip
# counts for a gate are independent tallies, not a state machine that
# overwrites itself. The ONLY thing that clears an unreconciled skip is a
# human-recorded acceptance for that phase. This is intentional: the Phase 82
# incident was about individual epics' own honest gaps, and a later,
# unrelated pass (e.g. the wave-level integration gate happening to pass)
# does not retroactively make an individual epic's own skip not have
# happened — it still needs to be seen and acknowledged.
#
# Acceptance storage: `--accept-skips` does NOT append to .claude/audit.jsonl
# — E345 is scoped to add exactly one new event to that schema (`gate_result`,
# written by audit-emit-gate.sh). Acceptances are their own append-only JSONL
# ledger at docs/context/gate-skip-acceptances.jsonl (override:
# GATE_ACCEPT_LOG_PATH) — structured, diffable, and, critically, COMMITTED
# (unlike .claude/audit.jsonl, which is gitignored local telemetry). This is
# a deliberate human-judgment record, not operational noise: it must survive
# `git clone`, be visible identically across every `.claude/worktrees/agent-*`
# checkout /athena:batch dispatches into, and never silently vanish from a
# committed `docs/context/gate-ledger.md` re-render just because it happened
# on a different machine/worktree than the one that last regenerated the doc.
# `/athena:approve` already handles the analogous "record a human decision"
# problem by writing into committed `epic-progress.md`/`EPIC_INDEX.md`, not a
# gitignored file — this follows the same principle.
#
# docs/context/gate-ledger.md is a RENDER ARTIFACT, regenerated wholesale on
# every non-check-only run. Do not hand-edit it — edits are silently
# overwritten on the next run. docs/context/gate-skip-acceptances.jsonl is
# NOT a render artifact — it is hand-append-only (via --accept-skips), never
# regenerated from anything else, and IS the source of truth for acceptances.
#
# Environment overrides (for tests):
#   AUDIT_LOG_PATH       Override .claude/audit.jsonl path (read-only here)
#   GATE_ACCEPT_LOG_PATH Override docs/context/gate-skip-acceptances.jsonl path
#   GATE_LEDGER_PATH     Override docs/context/gate-ledger.md path
#   CLOCK_TS             Override timestamp (ISO 8601, for the accept-skips record)
#
# Exit codes:
#   0   report mode: always (even when unreconciled skips are shown — report
#       mode never blocks, it just shows the ledger). check-only mode: phase
#       has no unreconciled skip (including "no data recorded"). accept-skips
#       mode: acceptance recorded.
#   1   usage error (e.g. --accept-skips without --phase, or jq missing)
#   2   check-only mode ONLY: the named phase has an unreconciled skipped gate.

set -uo pipefail

# Resolve repo root (best-effort; fall back to cwd) — mirrors the audit-emit-* family.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" 2>/dev/null || true

AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
ACCEPT_LOG="${GATE_ACCEPT_LOG_PATH:-docs/context/gate-skip-acceptances.jsonl}"
LEDGER_DOC="${GATE_LEDGER_PATH:-docs/context/gate-ledger.md}"

usage() {
  cat >&2 <<'EOF'
Usage:
  gate-ledger.sh                                       # full report, all phases
  gate-ledger.sh --phase N                             # scoped report
  gate-ledger.sh --phase N --check-only                # exit 2 if unreconciled, else 0
  gate-ledger.sh --phase N --accept-skips "reason"      # HUMAN-ONLY acceptance
EOF
}

if ! command -v jq >/dev/null 2>&1; then
  echo "gate-ledger.sh: jq not found — cannot read the audit log" >&2
  exit 1
fi

PHASE=""
CHECK_ONLY=0
ACCEPT_SKIPS=""
HAS_ACCEPT=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --phase)        PHASE="${2:-}"; shift 2 2>/dev/null || shift $# ;;
    --check-only)   CHECK_ONLY=1; shift ;;
    --accept-skips) ACCEPT_SKIPS="${2:-}"; HAS_ACCEPT=1; shift 2 2>/dev/null || shift $# ;;
    *)
      echo "gate-ledger.sh: unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ "$CHECK_ONLY" -eq 1 ] && [ -z "$PHASE" ]; then
  echo "gate-ledger.sh: --check-only requires --phase N" >&2
  usage
  exit 1
fi

if [ "$HAS_ACCEPT" -eq 1 ]; then
  if [ -z "$PHASE" ]; then
    echo "gate-ledger.sh: --accept-skips requires --phase N" >&2
    usage
    exit 1
  fi
  if [ -z "$ACCEPT_SKIPS" ]; then
    echo "gate-ledger.sh: --accept-skips requires a reason string" >&2
    usage
    exit 1
  fi
  if [ "$CHECK_ONLY" -eq 1 ]; then
    echo "gate-ledger.sh: --accept-skips and --check-only are mutually exclusive" >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Record the acceptance (if requested) BEFORE computing the summary, so the
# summary + report immediately reflect it. Appends to its OWN ledger file —
# NOT .claude/audit.jsonl (see header: E345 adds exactly one new audit event,
# gate_result; acceptances are a separate, purpose-built ledger).
# ---------------------------------------------------------------------------
if [ "$HAS_ACCEPT" -eq 1 ]; then
  mkdir -p "$(dirname "$ACCEPT_LOG")" 2>/dev/null || true
  TS="${CLOCK_TS:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
  jq -n -c \
    --arg ts "$TS" \
    --arg phase "$PHASE" \
    --arg reason "$ACCEPT_SKIPS" \
    '{ts:$ts,phase:$phase,reason:$reason}' \
    >> "$ACCEPT_LOG"
  echo "gate-skip acceptance recorded: phase=$PHASE ts=$TS ($ACCEPT_LOG)" >&2
fi

# ---------------------------------------------------------------------------
# Build the per-phase summary. `gates` (pass/fail/skipped + skip reasons)
# comes from .claude/audit.jsonl's gate_result events; `lastAcceptTs` /
# `acceptReason` come from the separate acceptance ledger. Empty/missing
# files -> `[]` under `jq -s`, handled as "no data" throughout.
#
# SOURCE SPLIT (E362): a `gate_result` event can come from two genuinely
# different call sites that this ledger must NOT blend together —
#   - `sources.wave`    — the wave-level integration gate: `/athena:integrate`
#                          Step 4 or `batch.md` Step 4c. These either omit
#                          `epic` entirely (batch.md 4c) or, in principle,
#                          could carry a comma-joined multi-epic string
#                          (integrate.md's `$EPICS_JOINED`) — either way the
#                          field is empty for a SINGLE epic's own gate.
#   - `sources.perEpic`  — `scripts/pre-merge-check.sh`'s own `emit_gate`,
#                          which always tags a single real epic ID.
# The split key is simply "does this event's `epic` field have a value at
# all" — see docs/epics/e362-batch-per-epic-prepublish-gate.md AC #3. This is
# what caught the actual incident: Phase 83–87 have wave-only data (empty
# `epic`) and ZERO per-epic events, meaning `pre-merge-check.sh` never ran on
# any of those phases' per-epic publishes even though `loop.md`'s canonical
# block called it MANDATORY. See render_phase()'s explicit warning below —
# a phase with wave data but an empty perEpic bucket must never render as if
# nothing were missing.
# ---------------------------------------------------------------------------
mkdir -p "$(dirname "$ACCEPT_LOG")" 2>/dev/null || true

# NOTE: pass the file to jq directly (not via `cat | jq`) — under `set -o
# pipefail` (active for this whole script), a missing AUDIT_LOG/ACCEPT_LOG
# makes `cat` fail even though `jq -s` on empty stdin is perfectly valid
# ([] / {}), and pipefail then propagates that failure through the pipe,
# double-triggering the `|| echo '{}'` fallback on top of jq's own good
# output (two concatenated '{}' objects — invalid JSON, and a real bug this
# script shipped with once already). Guarding with `[ -f ... ]` up front and
# calling `jq -s -c '...' "$file"` directly sidesteps that entirely.
GATES_JSON='{}'
if [ -f "$AUDIT_LOG" ]; then
  GATES_JSON=$(jq -s -c '
    def gate_bucket(items):
      items
      | group_by(.gate)
      | map({
          key: .[0].gate,
          value: {
            pass:    (map(select(.status=="pass"))    | length),
            fail:    (map(select(.status=="fail"))    | length),
            skipped: (map(select(.status=="skipped")) | length),
            skips:   (map(select(.status=="skipped")) | map({epic: (.epic // "?"), reason: (.reason // "(no reason recorded)"), ts: .ts}))
          }
        })
      | from_entries;
    [.[] | select(.event=="gate_result")]
    | group_by(.phase // "unknown")
    | map({
        phase: (.[0].phase // "unknown"),
        sources: {
          wave:    gate_bucket([.[] | select((.epic // "") == "")]),
          perEpic: gate_bucket([.[] | select((.epic // "") != "")])
        },
        lastSkipTs: (map(select(.status=="skipped")) | map(.ts) | sort | last)
      })
    | map({(.phase): .}) | add // {}
  ' "$AUDIT_LOG" 2>/dev/null)
  if [ -z "$GATES_JSON" ] || [ "$GATES_JSON" = "null" ]; then
    GATES_JSON='{}'
  fi
fi

ACCEPTS_JSON='{}'
if [ -f "$ACCEPT_LOG" ]; then
  ACCEPTS_JSON=$(jq -s -c '
    group_by(.phase)
    | map({
        phase: .[0].phase,
        lastAcceptTs: (map(.ts) | sort | last),
        acceptReason: (sort_by(.ts) | last | .reason)
      })
    | map({(.phase): .}) | add // {}
  ' "$ACCEPT_LOG" 2>/dev/null)
  if [ -z "$ACCEPTS_JSON" ] || [ "$ACCEPTS_JSON" = "null" ]; then
    ACCEPTS_JSON='{}'
  fi
fi

SUMMARY_JSON=$(jq -n -c --argjson gates "$GATES_JSON" --argjson accepts "$ACCEPTS_JSON" '
  ($gates | keys) + ($accepts | keys) | unique | map(select(. != "unknown")) as $phases
  | reduce $phases[] as $p (
      {};
      . + {
        ($p): (
          ($gates[$p] // {phase: $p, sources: {wave: {}, perEpic: {}}, lastSkipTs: null}) as $g
          | ($accepts[$p] // {lastAcceptTs: null, acceptReason: null}) as $a
          | {
              phase: $p,
              sources: $g.sources,
              lastSkipTs: $g.lastSkipTs,
              lastAcceptTs: $a.lastAcceptTs,
              acceptReason: $a.acceptReason,
              # Existence-only, NOT a timestamp comparison — see the header
              # comment ("Unreconciled — DELIBERATE SEMANTICS") for why:
              # acceptance is phase-scoped and durable, so "has any acceptance
              # ever been recorded for this phase" is the whole test. Do not
              # reintroduce `$a.lastAcceptTs < $g.lastSkipTs` here — that is
              # the exact second-resolution race this rewrite removed.
              unreconciled: (($g.lastSkipTs != null) and ($a.lastAcceptTs == null))
            }
        )
      }
    )
' 2>/dev/null || echo '{}')

if [ -z "$SUMMARY_JSON" ] || [ "$SUMMARY_JSON" = "null" ]; then
  SUMMARY_JSON='{}'
fi

phase_has_data() {
  echo "$SUMMARY_JSON" | jq -e --arg p "$1" \
    'has($p) and ((((.[$p].sources.wave // {}) | length) + ((.[$p].sources.perEpic // {}) | length)) > 0)' \
    >/dev/null 2>&1
}

phase_unreconciled() {
  local u
  u=$(echo "$SUMMARY_JSON" | jq -r --arg p "$1" '.[$p].unreconciled // false')
  [ "$u" = "true" ]
}

# Render one source's gate table (wave | perEpic) for a phase, indented two
# spaces under that source's header line. Shared by both branches of
# render_phase() below (E362) — same pass/fail/skipped/skip-reason rendering
# either bucket uses, just scoped to `.sources[$source]` instead of the old
# flat `.gates`.
render_gate_table() {
  local phase="$1" source="$2" unrec="$3"
  echo "$SUMMARY_JSON" | jq -r --arg p "$phase" --arg s "$source" '
    (.[$p].sources[$s] // {}) | to_entries | sort_by(.key)[] |
    [.key, (.value.pass|tostring), (.value.fail|tostring), (.value.skipped|tostring)] | @tsv
  ' | while IFS=$'\t' read -r gate gpass gfail gskipped; do
    local parts=()
    [ "$gpass" != "0" ] && parts+=("${gpass} pass")
    [ "$gfail" != "0" ] && parts+=("${gfail} fail")
    [ "$gskipped" != "0" ] && parts+=("${gskipped} skipped")
    # Manual join (not IFS-based): the " · " separator is multi-byte/multi-char,
    # and `"${arr[*]}"` under a custom IFS only honours its FIRST character.
    local joined=""
    local p
    # bash 3.2 (macOS default) guard: expanding an empty array under `set -u`
    # is an unbound-variable error unless guarded this way (same idiom as
    # audit-emit-pipeline.sh).
    for p in ${parts[@]+"${parts[@]}"}; do
      [ -z "$p" ] && continue
      if [ -z "$joined" ]; then joined="$p"; else joined="$joined · $p"; fi
    done
    [ -z "$joined" ] && joined="0 pass"
    local marker=""
    if [ "$gskipped" != "0" ] && [ "$unrec" = "true" ]; then
      marker="  ⚠ 未結清"
    fi
    printf '    %-12s %s%s\n' "$gate" "$joined" "$marker"
    if [ "$gskipped" != "0" ]; then
      echo "$SUMMARY_JSON" | jq -r --arg p "$phase" --arg s "$source" --arg g "$gate" '
        .[$p].sources[$s][$g].skips[] | "      " + (.epic // "?") + " " + (.reason // "(no reason recorded)")
      '
    fi
  done
}

# Render the ledger text for one phase to stdout.
render_phase() {
  local phase="$1"
  echo "Phase ${phase} gate ledger"
  if ! phase_has_data "$phase"; then
    echo "  (no gate_result events recorded for this phase — audit-emit-gate.sh may not have existed yet, or no gate ran under it. See docs/epics/e345-gate-ledger.md.)"
    return
  fi

  local unrec="false"
  phase_unreconciled "$phase" && unrec="true"

  # E362 — two sources rendered separately (never blended): the wave-level
  # integration gate (/athena:integrate Step 4 or batch.md Step 4c — no
  # single-epic `epic` field) vs. per-epic scripts/pre-merge-check.sh (always
  # tags one epic). A phase can look "fully gated" from the wave section
  # alone while its per-epic bucket is silently empty — exactly the Phase
  # 83-87 incident this split exists to surface, so an empty perEpic bucket
  # is NEVER rendered as a quiet blank; it gets an explicit ⚠ line.
  local wave_count perepic_count
  wave_count=$(echo "$SUMMARY_JSON" | jq -r --arg p "$phase" '(.[$p].sources.wave // {}) | length')
  perepic_count=$(echo "$SUMMARY_JSON" | jq -r --arg p "$phase" '(.[$p].sources.perEpic // {}) | length')

  echo "  Wave 整合閘門 (epic 欄位為空 — /athena:integrate Step 4 或 batch.md Step 4c):"
  if [ "$wave_count" -gt 0 ]; then
    render_gate_table "$phase" "wave" "$unrec"
  else
    echo "    (本 phase 沒有任何 wave 整合閘門紀錄)"
  fi

  echo "  Per-epic pre-merge-check (epic 欄位有值 — scripts/pre-merge-check.sh):"
  if [ "$perepic_count" -gt 0 ]; then
    render_gate_table "$phase" "perEpic" "$unrec"
  else
    echo "    ⚠ 本 phase 沒有任何 per-epic 閘門紀錄 — pre-merge-check.sh 從未在任何一次 epic publish 時執行過（E362）"
  fi

  local accept_ts accept_reason
  accept_ts=$(echo "$SUMMARY_JSON" | jq -r --arg p "$phase" '.[$p].lastAcceptTs // empty')
  accept_reason=$(echo "$SUMMARY_JSON" | jq -r --arg p "$phase" '.[$p].acceptReason // empty')
  if [ -n "$accept_ts" ]; then
    echo "  ✓ skips accepted (${accept_ts}): ${accept_reason}"
  fi
}

# ---------------------------------------------------------------------------
# check-only mode: no stdout report, no doc write — just the exit code.
# ---------------------------------------------------------------------------
if [ "$CHECK_ONLY" -eq 1 ]; then
  if phase_has_data "$PHASE" && phase_unreconciled "$PHASE"; then
    exit 2
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Report mode: print to stdout (scoped to --phase if given, else every
# phase), then render docs/context/gate-ledger.md (always full, every phase —
# a render artifact, not scoped by the caller's --phase).
# ---------------------------------------------------------------------------
if [ -n "$PHASE" ]; then
  render_phase "$PHASE"
else
  ALL_PHASES=$(echo "$SUMMARY_JSON" | jq -r 'keys[]' | sort -n)
  if [ -z "$ALL_PHASES" ]; then
    echo "(no gate_result events recorded in $AUDIT_LOG yet)"
  else
    FIRST=1
    while IFS= read -r P; do
      [ -z "$P" ] && continue
      [ "$FIRST" -eq 0 ] && echo ""
      FIRST=0
      render_phase "$P"
    done <<< "$ALL_PHASES"
  fi
fi

# ---------------------------------------------------------------------------
# Render docs/context/gate-ledger.md (full regen, every phase in the log).
# ---------------------------------------------------------------------------
mkdir -p "$(dirname "$LEDGER_DOC")" 2>/dev/null || true
{
  echo "# Gate Ledger"
  echo ""
  echo "> **RENDER ARTIFACT — generated by \`scripts/gate-ledger.sh\`. Do not hand-edit;"
  echo "> this file is fully regenerated (and any hand edits silently overwritten) on"
  echo "> the next run.** Sources: \`gate_result\` events in \`.claude/audit.jsonl\`, plus"
  echo "> human acceptances in \`docs/context/gate-skip-acceptances.jsonl\` (COMMITTED,"
  echo "> not gitignored — E345, see"
  echo "> \`docs/epics/e345-gate-ledger.md\`)."
  echo ">"
  echo "> A phase with no section below has no \`gate_result\` events recorded — that"
  echo "> means nothing was emitted under it, not that every gate passed."
  echo ""
  echo "Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo ""
  ALL_PHASES=$(echo "$SUMMARY_JSON" | jq -r 'keys[]' | sort -n)
  if [ -z "$ALL_PHASES" ]; then
    echo "_(no gate_result events recorded yet)_"
  else
    while IFS= read -r P; do
      [ -z "$P" ] && continue
      echo "## Phase ${P}"
      echo ""
      echo '```'
      render_phase "$P"
      echo '```'
      echo ""
    done <<< "$ALL_PHASES"
  fi
} > "$LEDGER_DOC" 2>/dev/null || true

exit 0
