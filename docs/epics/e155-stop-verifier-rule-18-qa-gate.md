# E155 — Stop Verifier Rule #18: QA Gate Enforcement on Commit

> Phase 39 — Hardening | Size: S (3 SP) | Deps: none
> Source: ai-coding-template self-review (2026-04-15), companion to batch.md QA-skip guards

## Problem

The `/athena:batch`, `/athena:loop`, and related orchestrator commands were recently hardened with four redundant soft guards that forbid going from `implement → commit` without a passing `qa` step in between (see `.claude/commands/athena/batch.md` Mandatory Pipeline Order section). These guards live entirely in the command spec — they rely on the orchestrator agent reading and obeying the spec.

If any of the following occurs, the soft guards silently fail:
- A subagent interprets "execute next step" loosely
- `docs/context/epic-progress.md` state file is corrupted or hand-edited
- A future refactor reorders or omits qa from a pipeline
- A manual `git commit` is made on an epic branch outside the orchestrator

There is currently **no filesystem-level check** that refuses such a commit. Untested code can reach main.

## Solution

Add a new Stop-verifier rule (Rule #18: QA Gate Enforcement) to `scripts/hooks/stop-verifier.sh` that mechanically refuses any Stop event when:
- The current branch matches `^feat/e[0-9]+-` (an epic feature branch)
- The matching epic row in `docs/context/epic-progress.md` shows `impl=✅` AND `qa ∈ {⬜, ❌}`

This moves the guarantee from "agent obedience" to "shell-script refusal" — the strongest form of enforcement available in this project's toolchain.

## Key Files

| File | Action |
|------|--------|
| `scripts/hooks/stop-verifier.sh` | Edit — add `rule_18_qa_gate()` function + dispatch |
| `scripts/hooks/tests/test-rule-18-qa-gate.sh` | New — 5 test cases (fail, pass, edge×3) |
| `scripts/hooks/CLAUDE.md` | Edit — document Rule 18 |
| `CLAUDE.md` | Edit — update rule count from 17 → 18 in the "Stop verifier" line |
| `docs/epics/e155-stop-verifier-rule-18-qa-gate.md` | New — this spec |

## Implementation

### Rule 18 function (pseudocode)

```bash
# Rule 18: QA Gate Enforcement — epic branches cannot Stop with impl=✅ but qa=⬜
rule_18_qa_gate() {
  local branch
  branch=$(git branch --show-current 2>/dev/null) || return 0

  # Only applies to epic feature branches
  [[ "$branch" =~ ^feat/e([0-9]+)- ]] || return 0
  local epic_num="${BASH_REMATCH[1]}"
  local epic_id="E${epic_num}"

  local progress_file="docs/context/epic-progress.md"
  [[ -f "$progress_file" ]] || return 0

  # Extract the row for this epic
  local row
  row=$(grep -E "^\| *${epic_id} " "$progress_file" || true)
  [[ -n "$row" ]] || return 0  # no matching row → silent pass

  # Parse step columns (spec | impl | qa | commit | merge)
  # Columns layout assumed by epic-progress.md: | E{n} | name | spec | impl | qa | commit | merge |
  local impl_col qa_col
  impl_col=$(echo "$row" | awk -F'|' '{gsub(/^ +| +$/, "", $5); print $5}')
  qa_col=$(echo "$row"   | awk -F'|' '{gsub(/^ +| +$/, "", $6); print $6}')

  # Fail only when implement is done but qa isn't passing
  if [[ "$impl_col" == "✅" ]] && [[ "$qa_col" != "✅" ]]; then
    echo "Rule 18: Epic ${epic_id} has impl=✅ but qa=${qa_col}." >&2
    echo "  Run /athena:qa for ${epic_id} before committing/shipping." >&2
    echo "  (This rule mechanizes the Mandatory Pipeline Order contract" >&2
    echo "   from .claude/commands/athena/batch.md.)" >&2
    return 1
  fi
  return 0
}
```

### Dispatch

Add to the main verifier loop near the other feature-branch-scoped rules.

### Tests

Create `scripts/hooks/tests/test-rule-18-qa-gate.sh` with cases:

| # | Branch | State row | Expected |
|---|---|---|---|
| 1 | `feat/e999-fake` | `impl=✅ qa=⬜` | **fail** (exit 1) |
| 2 | `feat/e999-fake` | `impl=✅ qa=❌` | **fail** (exit 1) |
| 3 | `feat/e999-fake` | `impl=✅ qa=✅` | pass |
| 4 | `feat/e999-fake` | `impl=⬜ qa=⬜` | pass (not yet implementing) |
| 5 | `main`           | any          | pass (rule doesn't apply) |
| 6 | `feat/e999-fake` | no matching row | pass (silent — new epic) |

## Acceptance Criteria

1. Rule 18 is live in `stop-verifier.sh` and gated on `^feat/e[0-9]+-` branches only
2. All 6 test cases pass (`bash scripts/hooks/tests/test-rule-18-qa-gate.sh`)
3. `CLAUDE.md` "Stop verifier" rule count updated from 17 → 18
4. `scripts/hooks/CLAUDE.md` lists Rule 18 with one-line description
5. Manual verification: create throwaway `feat/e999-rule18-test` branch, add a row to epic-progress.md with `impl=✅ qa=⬜`, attempt a Stop — observe refusal; flip `qa=✅` — observe pass

## Why This Matters

The soft guards in `batch.md` are layer 1 — they cover the happy path where orchestrators obey the spec. Rule 18 is layer 2 — it catches the cases where layer 1 fails, which is precisely the scenario that motivates the fix (orchestrators sometimes don't obey specs; that's why the bug existed in the first place).

Defense in depth: one rule would have been enough if agents were perfectly obedient. Since they're not, we need both.

## Dependencies

None. Self-contained. Does not require changes to any agent, command, or data format.

## Non-Goals

- Does NOT modify any existing Stop verifier rule
- Does NOT change `epic-progress.md` format
- Does NOT add a pre-commit hook (Stop verifier is the agreed enforcement surface)
- Does NOT enforce qa for non-epic work (chore branches, hotfixes, doc-only commits)
