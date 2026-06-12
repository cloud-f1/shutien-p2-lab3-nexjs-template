# E164 — Autopilot Mode with Confidence Gates

> Phase 40 — Self-Review Improvements | Size: M (5 SP) | Deps: E162 (convergence loop provides a confidence signal)
> Source: industry signal 2026-04-24 (Drafted — AI-first org: decide what AI can do first, humans fill the rest)

## Problem

Current pipeline has many human gates:

- `/athena:plan` → human approves epics before batch
- `/athena:promote` → human triggers (E158 softens this but still draft-only)
- `/athena:deploy` → 6-gate, but final push is human
- Merge to main → human PR approval

Each gate is valuable in isolation. In aggregate they create **pipeline stalls**: the system can't make progress without a human in the loop, even when all signals are unambiguously green.

The Drafted pattern (article, 2026-04-24) inverts this: **decide what AI can do first, then have humans fill only the gaps**. Translated to this template: the pipeline should auto-advance when a **confidence score** is above threshold, and only stop for human review when confidence is ambiguous.

## Solution

Introduce an **Autopilot Mode** with three ingredients:

### 1. Confidence score per step

Every pipeline step emits `confidence ∈ [0, 1]` based on observable signals:

| Step | Confidence signal |
|------|-------------------|
| `spec` | E156 contract test passes against draft + no ambiguous "TBD" tokens remain |
| `implement` | All tests green + coverage delta ≥ 0 + no new Stop-verifier violations |
| `qa` | E162 converged in ≤2 rounds + 0 HIGH findings + Test Quality Score ≥ 0.7 |
| `commit` | No secrets detected + commit message follows Conventional Commits |
| `merge` | CI green + no conflicts + PR labels match |
| `deploy` | All 7 gates pass + no SLI regression in last deploy |

Default threshold: `0.85`. Below = pause for human.

### 2. `/athena:autopilot <epic>` command

- Runs full `spec → implement → qa → commit → merge → deploy` for one epic
- At each step, if `confidence < threshold`: pause, emit `docs/context/autopilot-pause-<epic>-<step>.md` with:
  - why it paused (which signal failed)
  - what the human needs to decide
  - resume command: `/athena:autopilot <epic> --resume`
- If confidence ≥ threshold: auto-advance without asking

### 3. Reversibility budget

Autopilot is only safe if actions are reversible. Each auto-advanced step must meet:

| Step | Reversible how? |
|------|-----------------|
| spec | Just a doc edit; revert with `git checkout` |
| implement | Branch-scoped; never touches main |
| qa | Read-only |
| commit | Can `git reset` (on feature branch only) |
| merge | **requires human** unless PR auto-merge is explicitly enabled |
| deploy | Rollback via E159 `sre rollback` CLI within 10min window |

The epic enforces: `merge` is **never** auto-advanced without explicit `AUTOPILOT_ALLOW_MERGE=1`. `deploy` is only auto-advanced to staging, never prod.

## Key Files

| File | Action |
|------|--------|
| `.claude/commands/athena/autopilot.md` | New — command spec + confidence contract |
| `scripts/autopilot.sh` | New — harness; computes confidence from audit log + agent outputs |
| `scripts/confidence/spec.sh` | New — one scorer per step type |
| `scripts/confidence/implement.sh` | New |
| `scripts/confidence/qa.sh` | New |
| `scripts/confidence/commit.sh` | New |
| `.claude/settings.json` | Edit — env vars `AUTOPILOT_THRESHOLD`, `AUTOPILOT_ALLOW_MERGE` |
| `docs/guides/en/autopilot.md` | New — philosophy + safety model |
| `docs/guides/zh-TW/autopilot.md` | New |
| `docs/context/autopilot-log.md` | New — audit trail of auto-advancements |

## Implementation

### Confidence scoring contract

```bash
# scripts/confidence/qa.sh — outputs a float to stdout
#!/usr/bin/env bash
set -euo pipefail

# Load the most recent qa audit entry for current epic
epic="$1"
audit=$(jq -s --arg e "$epic" '[.[] | select(.epic==$e and .event=="qa_complete")] | last' .claude/audit.jsonl)

rounds=$(echo "$audit" | jq -r '.rounds // 99')
high_findings=$(echo "$audit" | jq -r '.high_findings // 99')
tqs=$(echo "$audit" | jq -r '.test_quality_score // 0')

# Formula: penalize rounds, hard fail on HIGH, linear on TQS
if (( high_findings > 0 )); then echo "0.0"; exit 0; fi

score=$(awk -v r="$rounds" -v t="$tqs" 'BEGIN {
  round_factor = (r <= 2) ? 1.0 : (r == 3) ? 0.7 : 0.4
  print round_factor * t
}')

echo "$score"
```

### Autopilot pause artifact

```markdown
# Autopilot Pause — E123 / qa

- Confidence: 0.62 (threshold: 0.85)
- Reason: 3 rounds to converge (expected ≤2); Test Quality Score 0.68 (expected ≥0.7)

## What to decide
- Is the lower TQS acceptable for this epic? (e.g., unavoidable mocking in external API layer)
- Should we add the missing parametrize cases identified in Round 2?

## Resume
`/athena:autopilot E123 --resume`

## Signals
- rounds: 3
- high_findings: 0
- test_quality_score: 0.68
```

## Alignment / Cross-Epic Hooks

### Confidence signal inputs (reads from)

| Signal source | Read path | Upgrades from fallback when... |
|--------------|-----------|--------------------------------|
| E156 contract results | `.claude/audit.jsonl` event `qa_contract` | Phase 40 E156 landed |
| E157 migration signoff | `docs/context/migration-review/<rev>-signoff.md` | Phase 40 E157 landed |
| E162 convergence | `.claude/audit.jsonl` event `review_loop` `{rounds, final_issues}` | Phase 41 E162 landed (**hard dep**) |
| E159 SLI regression | `GET /admin/sli` + last deploy baseline | Phase 40 E159 landed |

Fallback mode (none of Phase 40 landed): autopilot reads only test-pass + coverage-delta + no-new-Stop-violations. Still useful, less discriminating.

### Writes to

- `docs/context/autopilot-log.md` — audit trail
- `docs/context/autopilot-pause-<epic>-<step>.md` — pause artifacts
- `.claude/audit.jsonl` event `autopilot_advance` and `autopilot_pause`

### Adds slash command

`/athena:autopilot` — bumps athena count by 1. Update CLAUDE.md + MEMORY.md command counts.

### Env contract

- `AUTOPILOT_THRESHOLD` (default 0.85)
- `AUTOPILOT_ALLOW_MERGE` (default unset → pause at merge)
- `AUTOPILOT_ALLOW_PROD_DEPLOY` (default unset → pause at prod deploy)
- `REVIEW_LOOP_BUDGET` — inherited from E162

### Does NOT bump Stop-verifier rule count

## Acceptance Criteria

- [ ] `/athena:autopilot <epic>` runs end-to-end with human-free advancement when confidence ≥ 0.85
- [ ] Pauses with clear artifact when any step scores below threshold
- [ ] `merge` never auto-advances without `AUTOPILOT_ALLOW_MERGE=1` (default off)
- [ ] `deploy` never auto-advances to prod without `AUTOPILOT_ALLOW_PROD_DEPLOY=1` (default off)
- [ ] Audit log entry for every auto-advancement with confidence + signals recorded
- [ ] Resume command picks up exactly where pause happened
- [ ] Documented threshold tuning: which confidence setting produced what human-touch rate over 10 epics

## Out of Scope

- ML-based confidence (use deterministic signals first — they're explainable)
- Auto-create-PR (that's an explicit gate, not a confidence call)
- Multi-epic autopilot waves (single epic first; batch autopilot = future)
