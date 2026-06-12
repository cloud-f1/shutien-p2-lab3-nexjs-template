# E162 — Iterative Reviewer Convergence Loop (RDT-inspired)

> Phase 40 — Self-Review Improvements | Size: M (5 SP) | Deps: none
> Source: industry signal 2026-04-24 (OpenMythos / RDT pattern — iterate on same artifact until converged)

## Problem

`@reviewer` (E87) runs **once** per QA cycle:

```
@reviewer → writes review-findings.md → done
@debugger picks up findings → fixes → commits
```

But the fix might introduce new issues. There's no second pass. The loop only closes via the next human-triggered `/athena:qa` run, often after the PR is already in review.

The RDT (Recurrent Transformer) pattern that hit 1.5M impressions this week frames this clearly: **reusing the same capability on the same input N times often beats a bigger one-shot pass**. Our reviewer is a 1-step pipeline where a 3-step iteration would catch chained issues.

## Solution

Turn `@reviewer` into an iterative convergence loop inside a single `/athena:qa --review-only` invocation:

```
iteration 0: @reviewer → finds N issues → writes round-0.md
iteration 1: @debugger fixes → @reviewer re-runs → finds M issues (on the fixes) → round-1.md
iteration 2: @debugger fixes → @reviewer re-runs → 0 issues → EXIT
```

Convergence criteria (any one stops the loop):

- 0 findings in current round
- Findings set is identical to previous round (stuck — human needed)
- Reached `MAX_ITERATIONS=4` (hard ceiling to avoid runaway)
- Budget: token count across rounds exceeds `REVIEW_LOOP_BUDGET` (env, default 50K)

## Key Files

| File | Action |
|------|--------|
| `.claude/commands/athena/qa.md` | Edit `--review-only` to drive convergence loop |
| `.claude/agents/reviewer.md` | Edit — make agent idempotent per round; input = previous round's findings + fix diff |
| `.claude/agents/debugger.md` | Edit — "review round" mode: fix only items from `review-findings.md` round-N |
| `docs/context/review-findings.md` | Format change — sectioned by round: `## Round 0`, `## Round 1`, etc. |
| `scripts/reviewer-loop.sh` | New — harness that orchestrates rounds + enforces convergence criteria |
| `docs/context/qa-patterns.md` | Append — "Iterative review convergence pattern" |

## Implementation

### reviewer-loop.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

MAX_ITERATIONS="${MAX_ITERATIONS:-4}"
BUDGET="${REVIEW_LOOP_BUDGET:-50000}"

round=0
prev_hash=""
total_tokens=0

while (( round < MAX_ITERATIONS )); do
  # Invoke @reviewer; it appends ## Round $round to review-findings.md
  # (Actual agent spawn happens via the command spec; this script tracks state.)
  echo "Round $round — invoking @reviewer"

  # Extract current round findings hash
  current=$(awk "/^## Round ${round}\$/,/^## Round /" docs/context/review-findings.md \
    | grep -vE '^## Round ' | sha256sum | cut -d' ' -f1)

  # Exit conditions
  if grep -qE "^## Round ${round}\$" docs/context/review-findings.md; then
    issue_count=$(awk "/^## Round ${round}\$/,/^## Round /" docs/context/review-findings.md \
      | grep -cE '^- \[ \]' || true)
  else
    issue_count=0
  fi

  if (( issue_count == 0 )); then
    echo "CONVERGED at round $round"
    break
  fi
  if [[ "$current" == "$prev_hash" ]] && (( round > 0 )); then
    echo "STUCK — findings identical to previous round. Human required."
    exit 2
  fi

  prev_hash="$current"
  round=$((round + 1))

  # Invoke @debugger in "round" mode (fixes only current round items)
  echo "Round $round — invoking @debugger"
done

# Audit
printf '{"ts":"%s","event":"review_loop","rounds":%d,"final_issues":%d}\n' \
  "$(date -u +%FT%TZ)" "$round" "$issue_count" >> .claude/audit.jsonl
```

### review-findings.md format

```markdown
# Review Findings

## Round 0 — 2026-04-24T14:30Z
- [x] Missing error boundary on /dashboard route (HIGH)
- [x] Hardcoded staleTime: 60000 in UserProfile.tsx (MED)

## Round 1 — 2026-04-24T14:35Z
- [x] New: ErrorBoundary fallback doesn't log to Sentry (MED, regression from Round 0 fix)

## Round 2 — 2026-04-24T14:38Z
(no findings — converged)
```

## Alignment / Cross-Epic Hooks

- **Writes to**: `docs/context/review-findings.md` (new sectioned-by-round format), `.claude/audit.jsonl` event `review_loop` with `{rounds, final_issues}`
- **Consumed by**: E164 autopilot QA confidence scorer (fewer rounds → higher confidence)
- **Changes agent contract**: `@reviewer` becomes idempotent per round; `@debugger` gains "round mode" (fix only items from `## Round N` section)
- **Does NOT bump** Stop-verifier rule count
- **Format migration note**: existing `review-findings.md` entries should be wrapped into a synthetic `## Round 0 (pre-E162)` section to preserve history
- **Budget env vars**: `MAX_ITERATIONS` (default 4), `REVIEW_LOOP_BUDGET` (default 50000 tokens)

## Acceptance Criteria

- [ ] `/athena:qa --review-only` runs up to `MAX_ITERATIONS=4` rounds
- [ ] Exits early on 0 findings, identical findings (stuck), or budget exceeded
- [ ] `review-findings.md` sections are cumulative (old rounds not deleted — provide history)
- [ ] Audit log entry records `rounds` count + `final_issues`
- [ ] Telemetry shows typical convergence in 2 rounds for template codebase
- [ ] Stuck detection surfaces to user with clear "needs human" signal
- [ ] No infinite loop possible (hard iteration + budget ceilings)

## Out of Scope

- Applying RDT to other agents (could generalize later to @spec-writer → @best-practice convergence)
- Cross-PR review memory (each PR starts fresh)
