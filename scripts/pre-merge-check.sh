#!/usr/bin/env bash
#
# pre-merge-check.sh — repo-sanity + quality gate the athena loop MUST pass
# before its `merge` step (git push + gh pr merge).
#
# Motivation (Phase 53 retro): the loop's merge step did `git push` +
# `gh pr merge --auto` with ZERO check on working-tree sanity. A half-migrated
# tree (464 uncommitted deletions + a nested next-app/.git) would have been
# pushed straight to the shared remote. This gate blocks that class of mistake.
#
# Usage:
#   scripts/pre-merge-check.sh            # repo-hygiene + typecheck + lint + unit tests
#   scripts/pre-merge-check.sh --e2e      # also run the Playwright e2e suite (needs DB + server)
#   scripts/pre-merge-check.sh --allow-deletions   # don't fail on a large uncommitted-deletion count
#   PMC_EPIC=E123 PMC_PHASE=45 scripts/pre-merge-check.sh   # override gate_result epic/phase
#                                          # attribution instead of auto-detecting from the
#                                          # current branch name (E362 — needed when the caller
#                                          # publishes a branch it hasn't checked out, e.g.
#                                          # batch.md's Step 4 per-epic publish loop)
#
# Exit non-zero on any failed gate. Designed to be quiet on success.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/next-app"
RUN_E2E=0
ALLOW_DELETIONS=0
FAIL=0
DELETION_THRESHOLD=50

for arg in "$@"; do
  case "$arg" in
    --e2e) RUN_E2E=1 ;;
    --allow-deletions) ALLOW_DELETIONS=1 ;;
  esac
done

say()  { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$1"; }
bad()  { printf '  \033[31m✗ %s\033[0m\n' "$1"; FAIL=1; }
warn() { printf '  \033[33m! %s\033[0m\n' "$1"; }

# E345 — gate ledger emission. This is the gate humans/agents run most often
# before pushing (CLAUDE.md's own "Quality gate before merge" line), so it
# must feed the ledger too, not just /athena:integrate's Step 4 and batch.md's
# Step 4c. Best-effort epic/phase auto-detection from the current branch +
# epic-progress.md — a plain `pre-merge-check.sh` invocation has no epic/phase
# argument of its own, so this is inferred, not passed in. Emission is always
# `|| true`: a missing audit-emit-gate.sh or jq must never fail this gate.
#
# E362 — a caller MAY pre-export PMC_EPIC/PMC_PHASE and they win over the
# branch-name/epic-progress.md auto-detection below. This matters for
# batch.md's Step 4 publish loop: the orchestrator publishes several epics'
# branches in sequence WITHOUT checking any of them out (it pushes each
# `feat/E{n}-*` branch by name from whatever branch the orchestrator itself
# is on, often `main`), so `git branch --show-current` cannot identify which
# epic is being published — auto-detection alone would tag every one of
# those per-epic gate_result events with an empty (or wrong) epic, making
# them indistinguishable from the wave-integration gate's own events in
# gate-ledger.sh's per-epic/wave split. A plain, un-annotated invocation
# (ship.md, pr.md, a human running this by hand from a checked-out feature
# branch) is untouched — PMC_EPIC/PMC_PHASE are unset in that case, so
# detection falls through to the original branch-name/epic-progress.md logic
# exactly as before.
PMC_EPIC="${PMC_EPIC:-}"
if [ -z "$PMC_EPIC" ]; then
  PMC_EPIC=$(git branch --show-current 2>/dev/null | sed -nE 's|.*[Ee]([0-9]+)-.*|E\1|p' | tr '[:lower:]' '[:upper:]')
fi
PMC_PHASE="${PMC_PHASE:-}"
if [ -z "$PMC_PHASE" ] && [ -n "$PMC_EPIC" ] && [ -f "$ROOT/docs/context/epic-progress.md" ]; then
  PMC_ROW=$(grep -E "^\| *${PMC_EPIC} " "$ROOT/docs/context/epic-progress.md" | head -1)
  PMC_PHASE=$(printf '%s' "$PMC_ROW" | sed -nE 's/.*Phase ([0-9]+).*/\1/p' | head -1)
fi
emit_gate() {
  # $1 = gate name, $2 = pass|fail
  bash "$ROOT/scripts/hooks/audit-emit-gate.sh" "$1" "$2" --epic "$PMC_EPIC" --phase "$PMC_PHASE" >/dev/null 2>&1 || true
}

# ── Gate 1: no stray nested git repo ────────────────────────────────────────
say "Repo hygiene"
if [ -d "$APP/.git" ]; then
  bad "next-app/.git exists — nested repo breaks commit/merge and git toplevel resolution. Remove it (the outer repo is canonical)."
else
  ok "no nested next-app/.git"
fi

# ── Gate 2: guard against an accidental mass-deletion push ───────────────────
DELETED=$(cd "$ROOT" && git status --porcelain 2>/dev/null | grep -c '^ *D')
if [ "$DELETED" -ge "$DELETION_THRESHOLD" ] && [ "$ALLOW_DELETIONS" -eq 0 ]; then
  bad "$DELETED uncommitted deletions (>=$DELETION_THRESHOLD). If this is an intentional migration, re-run with --allow-deletions."
elif [ "$DELETED" -ge "$DELETION_THRESHOLD" ]; then
  warn "$DELETED uncommitted deletions — allowed via --allow-deletions"
else
  ok "$DELETED uncommitted deletions (under threshold)"
fi

# ── Gate 2.5: state drift (E353) ────────────────────────────────────────────
# docs/context/epic-progress.md is the SSOT (E196); docs/epics/EPIC_INDEX.md
# is a derived file rendered from it by scripts/state/render-index.sh. If
# someone hand-edits EPIC_INDEX.md's sentinel blocks directly (instead of
# editing the SSOT and re-rendering), the two drift apart silently — that is
# exactly what happened when Phase 85 was closed out by editing the derived
# file only (PR #136 merged with 13 mismatches, caught after the fact by
# PR #137). Docs-only and fast, so it runs here, before typecheck.
say "State drift"
if bash "$ROOT/scripts/state/check-drift.sh" >/tmp/pmc-drift.log 2>&1; then
  ok "docs/epics/EPIC_INDEX.md matches docs/context/epic-progress.md"
else
  bad "state drift detected between EPIC_INDEX.md and epic-progress.md — run scripts/state/render-index.sh to reconcile, then commit both files together (see /tmp/pmc-drift.log)"
fi

# ── Gate 2.6: state internal consistency (E361) ─────────────────────────────
# check-drift.sh (Gate 2.5, above) only asks "are epic-progress.md and
# EPIC_INDEX.md in sync" — the two files can be byte-identical and BOTH
# wrong (Phase 86 close-out left the Phase Status row at "🟢 APPROVED" after
# all 4 of its epics were fully done; render-index.sh faithfully copied that
# wrong value into EPIC_INDEX.md, so check-drift.sh returned 0). This gate
# instead checks epic-progress.md's OWN content for self-contradictions: a
# step marked done while an earlier step in the same row is still pending
# (time-impossible — e.g. commit=✅ while implement=⬜), and a phase whose
# every epic is fully done/skip but whose Phase Status row isn't "✅
# Complete". See scripts/state/check-consistency.sh's header for the full
# rule list and the deliberately-not-implemented rule, and its module
# comment for why this does NOT duplicate Gate 2.5.
say "State internal consistency"
if bash "$ROOT/scripts/state/check-consistency.sh" >/tmp/pmc-consistency.log 2>&1; then
  ok "docs/context/epic-progress.md is internally self-consistent"
else
  bad "epic-progress.md contradicts itself — see /tmp/pmc-consistency.log for the exact epic/phase and cells"
fi
if grep -q 'WARN —' /tmp/pmc-consistency.log 2>/dev/null; then
  warn "$(grep 'WARN —' /tmp/pmc-consistency.log | head -1 | sed -E 's/^[^:]*check-consistency\.sh: //')"
fi

# ── Gate 3: typecheck ───────────────────────────────────────────────────────
say "Typecheck"
if (cd "$APP" && pnpm -s typecheck >/tmp/pmc-tsc.log 2>&1); then ok "tsc --noEmit clean"; emit_gate typecheck pass; else bad "typecheck failed (see /tmp/pmc-tsc.log)"; emit_gate typecheck fail; fi

# ── Gate 4: lint ────────────────────────────────────────────────────────────
say "Lint"
if (cd "$APP" && pnpm -s lint >/tmp/pmc-lint.log 2>&1); then ok "eslint clean"; emit_gate lint pass; else bad "lint failed (see /tmp/pmc-lint.log)"; emit_gate lint fail; fi

# ── Gate 5: unit tests ──────────────────────────────────────────────────────
say "Unit tests (vitest)"
if (cd "$APP" && pnpm -s test >/tmp/pmc-unit.log 2>&1); then ok "unit tests pass"; emit_gate unit pass; else bad "unit tests failed (see /tmp/pmc-unit.log)"; emit_gate unit fail; fi

# ── Gate 6 (optional): e2e ──────────────────────────────────────────────────
# Note: e2e here is opt-in (--e2e flag) — when this flag is omitted, e2e is
# simply not run by THIS invocation, and nothing is emitted for it. That is
# not the same as a structured `skipped` record (no reason is being declared
# here — the caller just didn't ask for it this run), so it's left silent,
# consistent with "no gate_result data" reading as "nothing to reconcile"
# throughout the ledger, not as a hidden skip.
if [ "$RUN_E2E" -eq 1 ]; then
  say "E2E (playwright)"
  if (cd "$APP" && pnpm -s test:e2e >/tmp/pmc-e2e.log 2>&1); then ok "e2e suite passes"; emit_gate e2e pass; else bad "e2e failed (see /tmp/pmc-e2e.log)"; emit_gate e2e fail; fi
fi

# ── Gate 7: command/agent frontmatter + stale-stack + tool-name lint ────────
# Non-fatal in the running pre-merge sense: command-lint.sh itself is fatal on
# (a) broken frontmatter and (d) a referenced scripts/*.sh path that doesn't
# exist, but warn-only on (b) stale-stack tokens and (c) the legacy `Task`
# tool name — see scripts/checks/command-lint.sh header for the full rubric.
# We run it in its own (non-strict) default mode here, so pre-merge-check
# fails only on the fatal class, not on every warning.
say "Command/agent lint (scripts/checks/command-lint.sh)"
if (cd "$ROOT" && bash scripts/checks/command-lint.sh >/tmp/pmc-command-lint.log 2>&1); then
  ok "command-lint clean (or warnings only — see /tmp/pmc-command-lint.log)"
else
  bad "command-lint FATAL finding(s) — see /tmp/pmc-command-lint.log"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  printf '\033[32m✅ pre-merge-check passed — safe to commit/merge\033[0m\n'
  exit 0
else
  printf '\033[31m❌ pre-merge-check FAILED — do NOT merge\033[0m\n'
  exit 1
fi
